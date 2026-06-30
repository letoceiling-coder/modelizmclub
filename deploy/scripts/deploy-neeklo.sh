#!/usr/bin/env bash
# Deploy backend for neeklo.modelizmclub.ru (pull configured git branch, migrate, cache).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub-neeklo}"
GIT_BRANCH="${NEEKLO_GIT_BRANCH:-neeklo}"

cd "${APP_DIR}"
git fetch origin
if git show-ref --verify --quiet "refs/remotes/origin/${GIT_BRANCH}"; then
  git checkout "${GIT_BRANCH}"
  git pull origin "${GIT_BRANCH}"
else
  echo "Branch origin/${GIT_BRANCH} not found — staying on $(git branch --show-current)" >&2
  git pull origin master || true
fi

cd backend
composer install --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache

systemctl restart neeklo-modelizmclub-reverb.service neeklo-modelizmclub-worker.service
systemctl reload php8.3-fpm

echo "Neeklo backend deploy OK: $(date -Iseconds)"
