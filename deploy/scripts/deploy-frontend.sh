#!/usr/bin/env bash
# Build and restart ModelizmClub frontend (modelizmclub.ru).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
FRONTEND_DIR="${APP_DIR}/frontend"

cd "${APP_DIR}"
git pull origin master

cd "${FRONTEND_DIR}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found — run deploy/scripts/setup-frontend-vps.sh first" >&2
  exit 1
fi

export NODE_ENV=production
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
