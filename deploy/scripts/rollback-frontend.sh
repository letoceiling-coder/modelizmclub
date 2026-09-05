#!/usr/bin/env bash
# Point the frontend back at the previous release — no rebuild.
#
#   rollback-frontend.sh              roll back to the previous release (asks)
#   rollback-frontend.sh --yes        the same without the question
#   rollback-frontend.sh --list       show what is available, newest first
#   rollback-frontend.sh <release>    switch to a named release
#
# Only ever repoints the .output symlink at a release that is already built and
# still on disk, so it takes about as long as a service restart.
#
# Which release is "previous" used to be decided by sorting names in reverse.
# That put `frontend-baseline-2026-09-03` above every `frontend-2026090513…`,
# because 'b' sorts after '2' — a rollback without arguments would have jumped
# to a two-day-old baseline instead of the release deployed twenty minutes
# earlier. Nobody noticed, because until 05.09 the rollback had never been run.
#
# Now the choice comes from two independent sources, in this order:
#   1. .worktrees/PREVIOUS — written by deploy-frontend.sh at the moment of the
#      swap, so it names exactly what was being served before;
#   2. modification time of the release directories, if that file is missing.
# Baseline is never chosen automatically: it is a floor to stand on, not a
# release to fall back to. Reaching it requires naming it.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"
WORKTREES_DIR="${APP_DIR}/.worktrees"
PREVIOUS_FILE="${WORKTREES_DIR}/PREVIOUS"
SERVICE="${ROLLBACK_SERVICE:-modelizmclub-frontend.service}"
HEALTH_URL="${FRONTEND_HEALTH_URL:-https://modelizmclub.ru/}"

is_baseline() { [[ "$(basename "$1")" == frontend-baseline-* ]]; }

# Newest first by modification time. `find -printf` keeps it to one pass.
releases() {
  find "${WORKTREES_DIR}" -maxdepth 1 -type d -name 'frontend-*' -printf '%T@ %p\n' 2>/dev/null |
    sort -rn | cut -d' ' -f2-
}

release_date() {
  date -d "@$(stat -c %Y "$1" 2>/dev/null || echo 0)" '+%d.%m %H:%M' 2>/dev/null || echo '?'
}

CURRENT=""
[[ -L "${FRONTEND_DIR}/.output" ]] && CURRENT="$(readlink -f "${FRONTEND_DIR}/.output" || true)"
current_dir() { [[ -n "${CURRENT}" ]] && dirname "$(dirname "${CURRENT}")" || true; }

ASSUME_YES=0
TARGET_ARG=""
for arg in "$@"; do
  case "${arg}" in
    --list)
      echo "релизы в ${WORKTREES_DIR} (свежие сверху):"
      while IFS= read -r r; do
        [[ -n "${r}" ]] || continue
        mark="  "
        [[ -n "${CURRENT}" && "${CURRENT}" == "${r}/frontend/.output" ]] && mark="* "
        note=""
        is_baseline "${r}" && note="  [базовый, только по имени]"
        printf '%s%-34s %s  %6s%s\n' \
          "${mark}" "$(basename "${r}")" "$(release_date "${r}")" \
          "$(du -sh "${r}/frontend/.output" 2>/dev/null | cut -f1 || echo '—')" "${note}"
      done < <(releases)
      echo ""
      echo "* — обслуживается сейчас"
      [[ -f "${PREVIOUS_FILE}" ]] && echo "предыдущий по записи деплоя: $(cat "${PREVIOUS_FILE}")"
      exit 0
      ;;
    --yes|-y) ASSUME_YES=1 ;;
    -*) echo "неизвестный ключ: ${arg}" >&2; exit 2 ;;
    *) TARGET_ARG="${arg}" ;;
  esac
done

mapfile -t ALL < <(releases)
[[ ${#ALL[@]} -gt 0 ]] || { echo "в ${WORKTREES_DIR} нет релизов — откатывать не на что" >&2; exit 1; }

if [[ -n "${TARGET_ARG}" ]]; then
  TARGET="${WORKTREES_DIR}/${TARGET_ARG}"
  [[ "${TARGET_ARG}" == frontend-* ]] || TARGET="${WORKTREES_DIR}/frontend-${TARGET_ARG}"
  SOURCE="указан по имени"
else
  TARGET=""
  SOURCE=""
  # 1. Что записал деплой в момент переключения.
  if [[ -f "${PREVIOUS_FILE}" ]]; then
    candidate="${WORKTREES_DIR}/$(cat "${PREVIOUS_FILE}")"
    if [[ -d "${candidate}" && "${candidate}" != "$(current_dir)" ]]; then
      TARGET="${candidate}"
      SOURCE="запись деплоя (.worktrees/PREVIOUS)"
    fi
  fi
  # 2. Иначе — самый свежий по времени, кроме текущего и базового.
  if [[ -z "${TARGET}" ]]; then
    for r in "${ALL[@]}"; do
      is_baseline "${r}" && continue
      [[ "${r}" == "$(current_dir)" ]] && continue
      TARGET="${r}"
      SOURCE="самый свежий по времени изменения"
      break
    done
  fi
  [[ -n "${TARGET}" ]] || {
    echo "кроме текущего релиза откатываться не на что" >&2
    echo "базовый релиз в обычный откат не входит — вызовите его по имени" >&2
    exit 1
  }
fi

OUT="${TARGET}/frontend/.output"
[[ -d "${TARGET}" ]] || { echo "релиз не найден: ${TARGET}" >&2; exit 1; }
[[ -d "${OUT}" ]]    || { echo "у релиза нет сборки: ${OUT}" >&2; exit 1; }
[[ -f "${OUT}/server/index.mjs" ]] || { echo "релиз неполный (нет server/index.mjs): ${OUT}" >&2; exit 1; }

echo "сейчас:   $(basename "$(current_dir)" 2>/dev/null || echo '<не симлинк>')  ($(release_date "$(current_dir)" 2>/dev/null || echo '?'))"
echo "откат на: $(basename "${TARGET}")  ($(release_date "${TARGET}"))"
[[ -n "${SOURCE}" ]] && echo "выбран:   ${SOURCE}"
is_baseline "${TARGET}" && echo "внимание: это базовый релиз, а не предыдущая выкатка"

if [[ "${ASSUME_YES}" != "1" ]]; then
  # Откат меняет то, что видят люди прямо сейчас. Спросить дешевле, чем
  # объяснять потом, почему сайт уехал на два дня назад.
  read -r -p "откатывать? [y/N] " answer
  case "${answer}" in
    y|Y|yes|да) ;;
    *) echo "отменено"; exit 0 ;;
  esac
fi

ln -sfn "${OUT}" "${FRONTEND_DIR}/.output.next"
mv -Tf "${FRONTEND_DIR}/.output.next" "${FRONTEND_DIR}/.output"
systemctl restart "${SERVICE}"

if "${APP_DIR}/deploy/scripts/smoke-check.sh" --frontend "${HEALTH_URL}"; then
  echo "откат выполнен -> $(basename "${TARGET}")"
else
  echo "откат выполнен, но смоук всё ещё падает — дело не в этом релизе" >&2
  exit 1
fi
