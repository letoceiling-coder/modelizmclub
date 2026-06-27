#!/usr/bin/env bash
# Build and restart ModelizmClub frontend (modelizmclub.ru).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"

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

bun install --frozen-lockfile 2>/dev/null || bun install
bun run build

chown -R www-data:www-data "${FRONTEND_DIR}/.output" "${FRONTEND_DIR}/.output/public" 2>/dev/null || \
  chown -R www-data:www-data "${FRONTEND_DIR}/.output" 2>/dev/null || true

if systemctl is-enabled modelizmclub-frontend.service >/dev/null 2>&1; then
  systemctl restart modelizmclub-frontend.service
  systemctl --no-pager status modelizmclub-frontend.service | head -5
else
  echo "WARN: modelizmclub-frontend.service not enabled — run setup-frontend-vps.sh"
fi

echo "Frontend deploy OK: $(date -Iseconds)"
