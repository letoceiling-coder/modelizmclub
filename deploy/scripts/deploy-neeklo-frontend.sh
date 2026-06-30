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
bun run build

chown -R www-data:www-data "${FRONTEND_DIR}/.output" 2>/dev/null || true

systemctl restart neeklo-modelizmclub-frontend.service
systemctl --no-pager status neeklo-modelizmclub-frontend.service | head -5

echo "Neeklo frontend deploy OK: $(date -Iseconds)"
