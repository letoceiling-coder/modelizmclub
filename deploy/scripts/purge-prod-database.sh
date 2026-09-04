#!/usr/bin/env bash
# Purge user-generated content on production, keeping only specified admin accounts.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
KEEP1="${1:-dmikhaylov79@yandex.ru}"
KEEP2="${2:-dsc-23@yandex.ru}"

cd "${APP_DIR}/backend"

echo "==> Purging content (keepers: ${KEEP1}, ${KEEP2})"
php artisan db:purge-content \
  --keep="${KEEP1}" \
  --keep="${KEEP2}" \
  --force

php artisan cache:clear
php artisan config:cache

echo "==> Purge complete: $(date -Iseconds)"
