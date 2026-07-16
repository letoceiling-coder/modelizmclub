#!/usr/bin/env bash
# Run PHPUnit against modelizmclub_test (PostgreSQL only).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

cd "${APP_DIR}/backend"

if [[ ! -f .env.testing ]]; then
  echo "Missing .env.testing — run: bash deploy/scripts/setup-test-db.sh" >&2
  exit 1
fi

php artisan config:clear

echo "==> PHPUnit on PostgreSQL database: modelizmclub_test"
php artisan test "$@"
