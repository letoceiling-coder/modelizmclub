#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/modelizmclub"

cd "${APP_DIR}"
git pull origin master

if [[ "${DEPLOY_REEXECED:-}" != 1 ]]; then
  export DEPLOY_REEXECED=1
  exec bash "$0" "$@"
fi

cd backend
composer install --optimize-autoloader --no-interaction
php artisan config:clear
php artisan migrate --force
php artisan db:seed --force
bash ../deploy/scripts/reset-demo-user.sh

if grep -q '^FEED_AUTO_PUBLISH=' .env 2>/dev/null; then
  sed -i 's/^FEED_AUTO_PUBLISH=.*/FEED_AUTO_PUBLISH=true/' .env
else
  echo 'FEED_AUTO_PUBLISH=true' >> .env
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true
bash ../deploy/scripts/export-openapi.sh 2>/dev/null || true

chown -R www-data:www-data storage bootstrap/cache
systemctl reload php8.3-fpm

echo "Deploy OK: $(date -Iseconds)"
