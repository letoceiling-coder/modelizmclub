#!/usr/bin/env bash
# Verify CDEK webhook subscription (no polling cron — Yandex uses per-order callback_url).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
BACKEND="${APP_DIR}/backend"
CRON_USER="${CRON_USER:-root}"
MARKER="# modelizmclub-laravel-scheduler"

echo "==> Remove delivery polling cron if present"
( crontab -u "${CRON_USER}" -l 2>/dev/null | grep -v "${MARKER}" || true ) | crontab -u "${CRON_USER}" -

echo "==> Verify CDEK webhook"
cd "${BACKEND}"
php scripts/register-cdek-webhook.php

echo "Done. Yandex: callback_properties.callback_url is sent on offers/create (see YANDEX_DELIVERY_CALLBACK_URL)."
