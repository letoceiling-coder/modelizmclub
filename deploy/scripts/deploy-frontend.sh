#!/usr/bin/env bash
# Build and restart ModelizmClub frontend (modelizmclub.ru).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"
SERVICE="modelizmclub-frontend.service"
HEALTH_URL="${FRONTEND_HEALTH_URL:-https://modelizmclub.ru/}"

# --- Журнал выкаток -----------------------------------------------------
#
# До 10.09 скрипт не писал ничего. Каталогов релизов на диске держится два,
# остальные подрезаются, и восстановить, что и когда выкатывали, можно было
# только по reflog прода — то есть по строкам «pull origin master:
# Fast-forward» без коммита, без длительности и без исхода. Разбор недели
# 03–10.09 на этом и споткнулся: 110 обновлений кода, а чем каждое было,
# видно не по журналу, а по догадке.
#
# Пишется одна строка на выкатку, и пишется всегда — в том числе когда
# выкатка провалилась и откатилась. Журнал, в котором есть только удачи,
# врёт молчанием: неудачная выкатка выглядит как её отсутствие.
#
# Ловушка на EXIT, а не строка в конце: при `set -e` любой сбой уводит из
# скрипта мимо конца, и запись бы не появилась именно тогда, когда она
# нужнее всего.
DEPLOY_LOG="${DEPLOY_LOG:-/var/log/modelizmclub/frontend-deploys.log}"
STARTED_AT="$(date +%s)"
RELEASE_ID="-"
DEPLOY_RESULT="прерван"

deploy_log_line() {
  local status="$1"
  local commit subject elapsed
  commit="$(git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" rev-parse --short HEAD 2>/dev/null || echo '-')"
  # Без обрезки: `cut -c` в локали C режет по байтам и рвёт многобайтовый
  # символ — в журнале оставался «подстановки и <?>». Тема идёт последним
  # полем, за ней ничего нет, и длина ничему не мешает.
  subject="$(git -c safe.directory="${APP_DIR}" -C "${APP_DIR}" log -1 --format=%s 2>/dev/null || echo '-')"
  elapsed="$(( $(date +%s) - STARTED_AT ))"

  mkdir -p "$(dirname "${DEPLOY_LOG}")" 2>/dev/null || return 0
  printf '%s\t%s\t%s\t%sс\t%s\t%s\n' \
    "$(date -Iseconds)" "${commit}" "${RELEASE_ID}" "${elapsed}" "${status}" "${subject}" \
    >> "${DEPLOY_LOG}" 2>/dev/null || true
}

trap 'deploy_log_line "${DEPLOY_RESULT}"' EXIT

cd "${APP_DIR}"
git -c safe.directory="${APP_DIR}" pull origin master

cd "${FRONTEND_DIR}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found — run deploy/scripts/setup-frontend-vps.sh first" >&2
  exit 1
fi

export NODE_ENV=production
export NITRO_PRESET=node-server

# Reverb / Echo — read public key from backend .env at build time
BACKEND_ENV="${FRONTEND_DIR}/../backend/.env"
if [[ -f "${BACKEND_ENV}" ]]; then
  REVERB_KEY="$(grep '^REVERB_APP_KEY=' "${BACKEND_ENV}" | cut -d= -f2- | tr -d '\"' | tr -d "'")"
  if [[ -n "${REVERB_KEY}" ]]; then
    export VITE_REVERB_APP_KEY="${REVERB_KEY}"
  fi
fi
export VITE_REVERB_HOST="${VITE_REVERB_HOST:-ws.modelizmclub.ru}"
export VITE_REVERB_PORT="${VITE_REVERB_PORT:-443}"
export VITE_REVERB_SCHEME="${VITE_REVERB_SCHEME:-https}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.modelizmclub.ru/api/v1}"
export VITE_DEMO_MODE="${VITE_DEMO_MODE:-false}"

# Build in an isolated git worktree instead of the live frontend/ directory.
# The old script ran `bun run build` straight into the live .output the
# running Node process was still serving from — a request landing mid-build
# could hit a chunk file the build had just deleted (real outage on the neeklo
# stand, 2026-07-14 17:43:51 UTC: ERR_MODULE_NOT_FOUND/ENOENT, user hit the
# app's error boundary while browsing during a redeploy). Redirecting Nitro's
# own output dir via the NITRO_OUTPUT_DIR env var turned out to be silently
# ignored by this project's vite-tanstack-config wrapper, so building fully
# outside frontend/ — where Nitro's default `<cwd>/.output` naturally lands
# somewhere harmless — is the reliable way to keep the live .output
# untouched until the swap at the very end.
WORKTREES_DIR="${APP_DIR}/.worktrees"
mkdir -p "${WORKTREES_DIR}"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"  # для журнала он объявлен выше
WORKTREE="${WORKTREES_DIR}/frontend-${RELEASE_ID}"

# Remember what we are serving now, so a failed smoke check can go straight back.
PREVIOUS_OUTPUT=""
if [[ -L "${FRONTEND_DIR}/.output" ]]; then
  PREVIOUS_OUTPUT="$(readlink -f "${FRONTEND_DIR}/.output" || true)"
fi

git worktree add --detach "${WORKTREE}" HEAD
cd "${WORKTREE}/frontend"
bun install --frozen-lockfile
bun run build

chown -R www-data:www-data "${WORKTREE}/frontend/.output"

cd "${FRONTEND_DIR}"
if [[ -e .output && ! -L .output ]]; then
  mv .output ".output.legacy-${RELEASE_ID}"
fi
ln -sfn "${WORKTREE}/frontend/.output" .output.next
mv -Tf .output.next .output

systemctl restart "${SERVICE}"
systemctl --no-pager status "${SERVICE}" | head -5

# Smoke check: a service that started is not the same as a site that answers.
# On failure the symlink goes back to the previous release — which is why the
# pruning below always keeps two.
if ! "${APP_DIR}/deploy/scripts/smoke-check.sh" --frontend "${HEALTH_URL}"; then
  echo "" >&2
  echo "SMOKE CHECK FAILED after deploying ${RELEASE_ID}." >&2
  if [[ -n "${PREVIOUS_OUTPUT}" && -d "${PREVIOUS_OUTPUT}" ]]; then
    echo "Rolling back to ${PREVIOUS_OUTPUT}" >&2
    ln -sfn "${PREVIOUS_OUTPUT}" "${FRONTEND_DIR}/.output.next"
    mv -Tf "${FRONTEND_DIR}/.output.next" "${FRONTEND_DIR}/.output"
    systemctl restart "${SERVICE}"
    echo "Rolled back. The failed release is still at ${WORKTREE}" >&2
    DEPLOY_RESULT="откат"
  else
    echo "No previous release to roll back to (first worktree deploy?)." >&2
    echo "Fix forward, or restore manually from ${WORKTREE}" >&2
    DEPLOY_RESULT="провал без отката"
  fi
  exit 1
fi

# Куда откатываться — записываем явно, в момент переключения. До 05.09 это
# решалось сортировкой имён в момент отката, и `frontend-baseline-2026-09-03`
# оказывался «свежее» любого `frontend-2026090513…`: 'b' сортируется после '2'.
if [[ -n "${PREVIOUS_OUTPUT}" ]]; then
  echo "$(basename "$(dirname "$(dirname "${PREVIOUS_OUTPUT}")")")" > "${WORKTREES_DIR}/PREVIOUS"
fi

# Keep the worktree just deployed plus one prior release for rollback
# headroom (the live .output symlink points into whichever worktree is
# current, so pruning must never touch the last two).
#
# Базовый релиз в ротации не участвует: он лежит отдельно как пол, на который
# можно встать руками. Раньше он занимал одно из двух мест «оставить» — и
# предыдущая выкатка удалялась, оставляя откат без цели. Сортировка — по
# времени изменения, а не по имени, по той же причине, что и в откате.
cd "${APP_DIR}"
mapfile -t OLD_WORKTREES < <(
  git worktree list --porcelain | awk '/^worktree /{print $2}' |
    grep "^${WORKTREES_DIR}/frontend-" | grep -v '/frontend-baseline-' |
    while IFS= read -r wt; do printf '%s %s\n' "$(stat -c %Y "${wt}" 2>/dev/null || echo 0)" "${wt}"; done |
    sort -rn | cut -d' ' -f2- | tail -n +3
)
# Живой релиз и цель отката не удаляются никогда, даже если по времени
# изменения они не в первой паре.
#
# «Оставить два самых свежих» держалось на допущении, что живой релиз и
# предыдущий — они и есть самые свежие. Провальная выкатка это допущение
# ломает: она собирает каталог и падает на smoke, каталог остаётся на диске
# (так и задумано — из него разбираются), и он новее живого. Двух провалов
# подряд хватает, чтобы обе «свежие» позиции заняли именно они.
#
# Тогда первая же успешная выкатка сносит каталог, на который сама же только
# что записала PREVIOUS: откат остаётся без цели и говорит «no previous
# release to roll back to». Сайт при этом цел — теряется ровно то, ради чего
# каталоги и держат.
#
# Найдено 10.09 после проверки журнала выкаток: два опыта с провалом оставили
# по 640 МБ, и стало видно, что подрезка считает их «свежими релизами».
PROTECTED=()
if [[ -L "${FRONTEND_DIR}/.output" ]]; then
  LIVE_OUTPUT="$(readlink -f "${FRONTEND_DIR}/.output" || true)"
  [[ -n "${LIVE_OUTPUT}" ]] && PROTECTED+=("$(dirname "$(dirname "${LIVE_OUTPUT}")")")
fi
if [[ -s "${WORKTREES_DIR}/PREVIOUS" ]]; then
  PROTECTED+=("${WORKTREES_DIR}/$(cat "${WORKTREES_DIR}/PREVIOUS")")
fi

for wt in "${OLD_WORKTREES[@]}"; do
  [[ -n "${wt}" ]] || continue

  keep=0
  for guarded in "${PROTECTED[@]}"; do
    if [[ -n "${guarded}" && "${wt}" == "${guarded}" ]]; then
      keep=1
      break
    fi
  done
  if (( keep )); then
    echo "оставляю ${wt##*/} — это живой релиз или цель отката"
    continue
  fi

  git worktree remove --force "${wt}" 2>/dev/null || rm -rf "${wt}"
done
git worktree prune

DEPLOY_RESULT="успех"
echo "Frontend deploy OK: ${RELEASE_ID} $(date -Iseconds)"
