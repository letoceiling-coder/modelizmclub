#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APP_DIR="/var/www/modelizmclub"
REPO_SSH="git@github.com:letoceiling-coder/modelizmclub.git"
REPO_HTTPS="https://github.com/letoceiling-coder/modelizmclub.git"
DOMAIN="dev.modelizmclub.ru"
DB_NAME="modelizmclub"
DB_USER="modelizmclub"
CERT_EMAIL="${CERT_EMAIL:-admin@modelizmclub.ru}"

echo "==> Установка пакетов"
apt-get update
apt-get install -y nginx postgresql postgresql-contrib redis-server \
  php8.3-fpm php8.3-cli php8.3-pgsql php8.3-redis php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath \
  certbot python3-certbot-nginx git unzip supervisor curl

if ! command -v composer >/dev/null 2>&1; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

echo "==> PostgreSQL"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi
echo "DB_PASSWORD=${DB_PASS}" > /root/modelizmclub-db.env
chmod 600 /root/modelizmclub-db.env

echo "==> Клонирование репозитория"
mkdir -p /var/www
if [ ! -d "${APP_DIR}/.git" ]; then
  mkdir -p ~/.ssh
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null || true
  if ! git clone "${REPO_SSH}" "${APP_DIR}" 2>/dev/null; then
    git clone "${REPO_HTTPS}" "${APP_DIR}"
  fi
fi

cd "${APP_DIR}/backend"

if [ ! -f .env ]; then
  cp .env.example .env
fi

composer install --no-dev --optimize-autoloader --no-interaction

if ! grep -q '^APP_KEY=base64:' .env 2>/dev/null; then
  php artisan key:generate --force
fi
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" .env
sed -i "s|^APP_ENV=.*|APP_ENV=development|" .env
php artisan migrate --force
php artisan db:seed --force

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

echo "==> nginx (HTTP)"
cp "${APP_DIR}/deploy/nginx/${DOMAIN}.http.conf" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx php8.3-fpm postgresql redis-server
systemctl restart nginx php8.3-fpm

echo "==> SSL"
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERT_EMAIL}" --redirect || true
fi

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  cp "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
  nginx -t && systemctl reload nginx
fi

php artisan config:cache
php artisan route:cache

echo "==> Готово"
echo "Health: https://${DOMAIN}/api/v1/health"
echo "DB credentials: /root/modelizmclub-db.env"
