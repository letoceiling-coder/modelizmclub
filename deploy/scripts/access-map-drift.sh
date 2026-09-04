#!/usr/bin/env bash
# Compares the access map saved in the database with the defaults the code
# declares in FeedGuestAccessRegistry.
#
# The map decides who sees what. On 04.09 `route.user` was found saved as
# `auth` while the registry declares `guest` and the router treats profiles as
# public — a guest could open a profile the map said was closed. Nobody had
# changed it recently and nothing reported it; it surfaced by accident during
# an unrelated audit. That is the schema-drift story again, with a blast radius
# that reaches users instead of migrations.
#
#   access-map-drift.sh            report overrides (exit 0)
#   access-map-drift.sh --strict   exit 1 when anything differs
#
# Warning by default, deliberately: the map is edited from /admin on purpose,
# so a difference is news, not a fault. What must not happen is a difference
# nobody knows about — which is why every deploy prints the list.
set -uo pipefail

export LC_ALL=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
BACKEND_DIR="${APP_DIR}/backend"
QUERY="${SCRIPT_DIR}/access-map-objects.php"

STRICT=0
for arg in "$@"; do
  case "${arg}" in
    --strict)  STRICT=1 ;;
    -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: ${arg}" >&2; exit 2 ;;
  esac
done

[[ -f "${QUERY}" ]] || { echo "access-map: no comparison script at ${QUERY}" >&2; exit 2; }

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

# Runs inside backend/ so the app's .env and its database connection are used.
if ! ( cd "${BACKEND_DIR}" && BACKEND_DIR="${BACKEND_DIR}" php "${QUERY}" ) > "${TMP}" 2>/dev/null; then
  echo "access-map: could not read the stored map" >&2
  exit 2
fi

TOTAL="$(grep '^TOTAL|' "${TMP}" | cut -d'|' -f2 | head -1)"
# No TOTAL line means the comparison never ran — a database it could not reach,
# a fatal error. Laravel's handler can still exit 0 in that case, so silence is
# not proof of agreement and must not be reported as "no overrides".
if [[ -z "${TOTAL}" ]]; then
  echo "access-map: the comparison produced no result — check the database connection in ${BACKEND_DIR}/.env" >&2
  ( cd "${BACKEND_DIR}" && BACKEND_DIR="${BACKEND_DIR}" php "${QUERY}" 2>&1 | head -4 | sed 's/^/  /' ) >&2
  exit 2
fi
OVERRIDES="$(grep -c '^OVERRIDE|' "${TMP}" || true)"
EXTRA="$(grep -c '^EXTRA|' "${TMP}" || true)"
NOTSAVED="$(grep -c '^NOTSAVED|' "${TMP}" || true)"
META="$(grep -c '^META|' "${TMP}" || true)"
TIER_DIFFS="$(awk -F'|' '$1=="OVERRIDE" && $4!=$5' "${TMP}" | grep -c . || true)"
DENY_DIFFS=$(( OVERRIDES - TIER_DIFFS ))
# NOTSAVED не входит в число расхождений: действующая карта уже содержит
# эти ключи со значениями реестра, устарела только сохранённая строка.
DIFFS=$(( OVERRIDES + EXTRA + META ))

report() {
  {
    if [[ "${DIFFS}" == "0" && "${NOTSAVED}" == "0" ]]; then
      echo "access map: расхождений нет — ${TOTAL:-0} действий совпадают с реестром"
      return
    fi

    if [[ "${DIFFS}" == "0" ]]; then
      echo "access map: действующая карта совпадает с реестром (${TOTAL:-0} действий)"
    else
      echo "access map: ${DIFFS} расхождени(е/я) с умолчаниями реестра (${TOTAL:-0} действий)"
      echo "  из них ${TIER_DIFFS} меняют уровень доступа, ${DENY_DIFFS} — только вид окна"
    fi

    # Два разных по смыслу изменения попадали бы в один список. Изменённый
    # min_tier двигает стену: кто-то видит то, чего не видел, или наоборот.
    # Изменённый deny_mode выбирает лишь вид окна, и сохранение карты из
    # /admin переписывает его сразу во всех строках. Без разделения три
    # десятка строк второго рода прячут десяток первого.
    if [[ "${TIER_DIFFS}" != "0" ]]; then
      echo "  уровень доступа изменён — именно это решает, кто что видит:"
      while IFS='|' read -r _ key label want have _ _; do
        [[ "${want}" == "${have}" ]] && continue
        printf '    %-34s %-12s -> %-12s (%s)\n' "${key}" "${want}" "${have}" "${label}"
      done < <(grep '^OVERRIDE|' "${TMP}")
    fi

    if [[ "${DENY_DIFFS}" != "0" ]]; then
      echo "  только вид окна (deny_mode), уровень тот же — действий: ${DENY_DIFFS}"
    fi

    if [[ "${NOTSAVED}" != "0" ]]; then
      echo "  добавлено в реестр после последнего сохранения карты — действует по"
      echo "  умолчанию, в сохранённой строке появится при первом сохранении из /admin:"
      grep '^NOTSAVED|' "${TMP}" | awk -F'|' '{printf "    %-34s %s\n", $2, $3}'
    fi

    if [[ "${EXTRA}" != "0" ]]; then
      echo "  сохранено в базе, но реестру неизвестно — переименованный или удалённый ключ:"
      grep '^EXTRA|' "${TMP}" | awk -F'|' '{printf "    %-34s %s\n", $2, $3}'
    fi

    if [[ "${META}" != "0" ]]; then
      echo "  верхнеуровневые настройки:"
      grep '^META|' "${TMP}" | awk -F'|' '{printf "    %-34s %s -> %s\n", $2, $3, $4}'
    fi
  } >> "$1"
}

report /dev/stdout

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  { echo "## Access map"; echo ""; echo '```'; } >> "${GITHUB_STEP_SUMMARY}"
  report "${GITHUB_STEP_SUMMARY}"
  echo '```' >> "${GITHUB_STEP_SUMMARY}"
fi

[[ "${DIFFS}" == "0" ]] && exit 0
[[ "${STRICT}" == "1" ]] && exit 1
echo "access-map: reporting only (pass --strict to make this a failure)"
exit 0
