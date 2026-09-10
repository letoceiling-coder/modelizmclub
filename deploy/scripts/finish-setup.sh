#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/modelizmclub"
DOMAIN="dev.modelizmclub.ru"

cd "${APP_DIR}/backend"

DB_PASS="$(grep DB_PASSWORD /root/modelizmclub-db.env | cut -d= -f2)"
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
sed -i "s|^APP_URL=.*|APP_URL=https://${DOMAIN}|" .env
sed -i "s|^APP_ENV=.*|APP_ENV=development|" .env

php artisan migrate --force
php artisan db:seed --force

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

cp "${APP_DIR}/deploy/nginx/${DOMAIN}.http.conf" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx php8.3-fpm postgresql redis-server
systemctl restart nginx php8.3-fpm

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m admin@modelizmclub.ru --redirect || true
fi

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  cp "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
  nginx -t && systemctl reload nginx
fi

php artisan config:cache

# Кеш конфига — это запечённый .env: пароль базы внутри открытым текстом.
# `config:cache` создаёт файл с умолчательными 644, то есть открывает его
# любому пользователю сервера. Возвращаем 640 сразу, иначе следующий запуск
# этого скрипта молча отменяет починку прав (см. deploy/README.md, «Доступ
# к .env»).
chmod 640 bootstrap/cache/config.php 2>/dev/null || true
php artisan route:cache

echo "Health: https://${DOMAIN}/api/v1/health"
