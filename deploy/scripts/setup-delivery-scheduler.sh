#!/usr/bin/env bash
# Install Laravel scheduler + verify CDEK webhook subscription on production.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
BACKEND="${APP_DIR}/backend"
CRON_USER="${CRON_USER:-root}"
MARKER="# modelizmclub-laravel-scheduler"

CRON_LINE="* * * * * cd ${BACKEND} && php artisan schedule:run >> ${BACKEND}/storage/logs/scheduler.log 2>&1 ${MARKER}"

echo "==> Installing Laravel scheduler cron for ${CRON_USER}"
( crontab -u "${CRON_USER}" -l 2>/dev/null | grep -v "${MARKER}" || true
  echo "${CRON_LINE}"
) | crontab -u "${CRON_USER}" -

echo "==> Current crontab:"
crontab -u "${CRON_USER}" -l | grep -F "${MARKER}" || true

echo "==> Verify delivery schedule"
cd "${BACKEND}"
php artisan schedule:list | grep -i delivery || true

echo "==> Verify / re-register CDEK webhook"
php scripts/register-cdek-webhook.php

echo "==> Test polling once"
php artisan delivery:sync-statuses --limit=50

echo "Done. delivery:sync-statuses runs every 5 minutes via schedule:run."
