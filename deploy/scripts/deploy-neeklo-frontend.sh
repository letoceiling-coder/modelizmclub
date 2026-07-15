#!/usr/bin/env bash
# Build and restart Neeklo frontend (neeklo.modelizmclub.ru :3002).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub-neeklo}"
FRONTEND_DIR="${APP_DIR}/frontend"
API_DOMAIN="${NEEKLO_API_DOMAIN:-neeklo-api.modelizmclub.ru}"

cd "${APP_DIR}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found — install via setup-frontend-vps.sh" >&2
  exit 1
fi

export NODE_ENV=production
export NITRO_PRESET=node-server
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

BACKEND_ENV="${APP_DIR}/backend/.env"
if [[ -f "${BACKEND_ENV}" ]]; then
  REVERB_KEY="$(grep '^REVERB_APP_KEY=' "${BACKEND_ENV}" | cut -d= -f2- | tr -d '\"' | tr -d "'")"
  if [[ -n "${REVERB_KEY}" ]]; then
    export VITE_REVERB_APP_KEY="${REVERB_KEY}"
  fi
fi
export VITE_REVERB_HOST="${VITE_REVERB_HOST:-neeklo-ws.modelizmclub.ru}"
export VITE_REVERB_PORT="${VITE_REVERB_PORT:-443}"
export VITE_REVERB_SCHEME="${VITE_REVERB_SCHEME:-https}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://${API_DOMAIN}/api/v1}"

# Build in an isolated git worktree instead of the live frontend/ directory.
# The old script ran `bun run build` straight into the live .output the
# running Node process was still serving from — a request landing mid-build
# could hit a chunk file the build had just deleted (real outage tonight,
# 2026-07-14 17:43:51 UTC: ERR_MODULE_NOT_FOUND/ENOENT, user hit the app's
# error boundary while browsing during a redeploy). Redirecting Nitro's own
# output dir via the NITRO_OUTPUT_DIR env var turned out to be silently
# ignored by this project's vite-tanstack-config wrapper, so building fully
# outside frontend/ — where Nitro's default `<cwd>/.output` naturally lands
# somewhere harmless — is the reliable way to keep the live .output
# untouched until the swap at the very end.
WORKTREES_DIR="${APP_DIR}/.worktrees"
mkdir -p "${WORKTREES_DIR}"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
WORKTREE="${WORKTREES_DIR}/frontend-${RELEASE_ID}"

git worktree add --detach "${WORKTREE}" HEAD
cd "${WORKTREE}/frontend"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build

chown -R www-data:www-data "${WORKTREE}/frontend/.output"

cd "${FRONTEND_DIR}"
if [[ -e .output && ! -L .output ]]; then
  mv .output ".output.legacy-${RELEASE_ID}"
fi
ln -sfn "${WORKTREE}/frontend/.output" .output.next
mv -Tf .output.next .output

systemctl restart neeklo-modelizmclub-frontend.service
systemctl --no-pager status neeklo-modelizmclub-frontend.service | head -5

# Keep the worktree just deployed plus one prior release for rollback
# headroom (the live .output symlink points into whichever worktree is
# current, so pruning must never touch the last two).
cd "${APP_DIR}"
mapfile -t OLD_WORKTREES < <(git worktree list --porcelain | awk '/^worktree /{print $2}' | grep "^${WORKTREES_DIR}/frontend-" | sort -r | tail -n +3)
for wt in "${OLD_WORKTREES[@]}"; do
  [[ -n "${wt}" ]] || continue
  git worktree remove --force "${wt}" 2>/dev/null || rm -rf "${wt}"
done
git worktree prune

echo "Neeklo frontend deploy OK: $(date -Iseconds)"
