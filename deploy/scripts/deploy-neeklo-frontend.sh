#!/usr/bin/env bash
# Build and restart Neeklo frontend (neeklo.modelizmclub.ru :3002).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub-neeklo}"
FRONTEND_DIR="${APP_DIR}/frontend"
API_DOMAIN="${NEEKLO_API_DOMAIN:-neeklo-api.modelizmclub.ru}"

cd "${FRONTEND_DIR}"

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

bun install --frozen-lockfile 2>/dev/null || bun install

# Build into a fresh, timestamped release dir and swap .output into place
# with an atomic symlink rename, instead of building straight into the live
# .output the running server reads from. The old in-place build let a
# request land mid-build and hit a chunk file the build had just deleted
# (real outage 2026-07-14: ERR_MODULE_NOT_FOUND/ENOENT while the previous
# deploy's `bun run build` was still writing). The swap below means the
# live process always sees either the complete old build or the complete
# new one, never a partial one.
mkdir -p releases
if [[ -e .output && ! -L .output ]]; then
  mv .output "releases/legacy-$(date +%Y%m%d%H%M%S)-pre-symlink"
fi

RELEASE_DIR="releases/$(date +%Y%m%d%H%M%S)"
mkdir -p "${RELEASE_DIR}"
NITRO_OUTPUT_DIR="${FRONTEND_DIR}/${RELEASE_DIR}/.output" bun run build

chown -R www-data:www-data "${RELEASE_DIR}/.output"

ln -sfn "${RELEASE_DIR}/.output" .output.next
mv -Tf .output.next .output

systemctl restart neeklo-modelizmclub-frontend.service
systemctl --no-pager status neeklo-modelizmclub-frontend.service | head -5

# Keep the release just deployed plus one prior build for rollback headroom.
ls -1dt releases/*/ 2>/dev/null | tail -n +3 | xargs -r rm -rf

echo "Neeklo frontend deploy OK: $(date -Iseconds)"
