#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/modelizmclub"

cd "${APP_DIR}"
git pull origin master

cd backend
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true

chown -R www-data:www-data storage bootstrap/cache
systemctl reload php8.3-fpm

echo "Deploy OK: $(date -Iseconds)"
