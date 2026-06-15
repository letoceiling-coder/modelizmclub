#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APP_DIR="/var/www/modelizmclub"
REPO="git@github.com:letoceiling-coder/modelizmclub.git"
DOMAIN="dev.modelizmclub.ru"
DB_NAME="modelizmclub"
DB_USER="modelizmclub"

echo "==> Установка пакетов"
apt-get update
apt-get install -y nginx postgresql postgresql-contrib redis-server \
  php8.3-fpm php8.3-cli php8.3-pgsql php8.3-redis php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath \
  certbot python3-certbot-nginx git unzip supervisor

if ! command -v composer >/dev/null 2>&1; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

echo "==> PostgreSQL"
DB_PASS="$(openssl rand -hex 16)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> Клонирование репозитория"
mkdir -p /var/www
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO}" "${APP_DIR}"
fi

cd "${APP_DIR}/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  php artisan key:generate
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" .env
  sed -i "s|^APP_ENV=.*|APP_ENV=development|" .env
  echo "Сохраните DB_PASSWORD: ${DB_PASS}"
fi

composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan db:seed --force
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache

echo "==> nginx"
cp "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m admin@${DOMAIN} || true
fi

nginx -t && systemctl reload nginx
systemctl enable nginx php8.3-fpm postgresql redis-server

echo "==> Готово: https://${DOMAIN}/api/v1/health"
