#!/usr/bin/env bash
# Build and restart ModelizmClub frontend (modelizmclub.ru).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"
SERVICE="modelizmclub-frontend.service"
HEALTH_URL="${FRONTEND_HEALTH_URL:-https://modelizmclub.ru/}"

cd "${APP_DIR}"
git -c safe.directory="${APP_DIR}" pull origin master

cd "${FRONTEND_DIR}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found — run deploy/setup/setup-frontend-vps.sh first" >&2
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
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
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
  else
    echo "No previous release to roll back to (first worktree deploy?)." >&2
    echo "Fix forward, or restore manually from ${WORKTREE}" >&2
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
for wt in "${OLD_WORKTREES[@]}"; do
  [[ -n "${wt}" ]] || continue
  git worktree remove --force "${wt}" 2>/dev/null || rm -rf "${wt}"
done
git worktree prune

echo "Frontend deploy OK: ${RELEASE_ID} $(date -Iseconds)"
