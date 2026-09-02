#!/usr/bin/env bash
# Run PHPUnit against modelizmclub_test (PostgreSQL only).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

cd "${APP_DIR}/backend"

if [[ ! -f .env.testing ]]; then
  echo "Missing .env.testing — run: bash deploy/scripts/setup-test-db.sh" >&2
  exit 1
fi

# config:clear makes php-fpm re-read config/database.php. Without a cached
# config, missing process env falls back to sqlite and listings/auth 500.
restore_prod_caches() {
  echo "==> Restoring Laravel config/route cache"
  php artisan config:cache
  php artisan route:cache
}
trap restore_prod_caches EXIT

php artisan config:clear
php artisan route:clear

echo "==> PHPUnit on PostgreSQL database: modelizmclub_test"
php artisan test "$@"
