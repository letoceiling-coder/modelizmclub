#!/usr/bin/env bash
# Run PHPUnit on the VPS (production/dev backend checkout).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
cd "${APP_DIR}/backend"

if ! php -m | grep -qi '^gd$'; then
  echo "Installing php8.3-gd for image upload tests..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq php8.3-gd
  systemctl reload php8.3-fpm 2>/dev/null || true
fi

if ! php -m | grep -qi 'pdo_sqlite'; then
  echo "Installing php8.3-sqlite3 for in-memory tests..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq php8.3-sqlite3
fi

php artisan config:clear
vendor/bin/phpunit "$@"

echo "Server tests OK: $(date -Iseconds)"
