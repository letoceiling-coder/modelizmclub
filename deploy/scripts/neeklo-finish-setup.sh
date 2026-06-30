#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/var/www/modelizmclub-neeklo"

bash "${APP_DIR}/deploy/scripts/neeklo-fix-db-grants.sh"

cd "${APP_DIR}/backend"
php artisan migrate --force
php artisan config:cache
php artisan route:cache
chown -R www-data:www-data storage bootstrap/cache

cp "${APP_DIR}/deploy/systemd/neeklo-modelizmclub-"*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable neeklo-modelizmclub-reverb neeklo-modelizmclub-worker neeklo-modelizmclub-frontend

for dom in neeklo.modelizmclub.ru neeklo-api.modelizmclub.ru neeklo-ws.modelizmclub.ru; do
  cp "${APP_DIR}/deploy/nginx/${dom}.http.conf" "/etc/nginx/sites-available/${dom}"
  ln -sf "/etc/nginx/sites-available/${dom}" "/etc/nginx/sites-enabled/${dom}"
done
nginx -t && systemctl reload nginx

for dom in neeklo.modelizmclub.ru neeklo-api.modelizmclub.ru neeklo-ws.modelizmclub.ru; do
  certbot --nginx -d "${dom}" --non-interactive --agree-tos -m admin@modelizmclub.ru --redirect 2>/dev/null || true
done

for dom in neeklo.modelizmclub.ru neeklo-api.modelizmclub.ru neeklo-ws.modelizmclub.ru; do
  if [[ -f "/etc/letsencrypt/live/${dom}/fullchain.pem" ]]; then
    cp "${APP_DIR}/deploy/nginx/${dom}.conf" "/etc/nginx/sites-available/${dom}"
  fi
done
nginx -t && systemctl reload nginx

bash "${APP_DIR}/deploy/scripts/deploy-neeklo-frontend.sh"
systemctl restart neeklo-modelizmclub-reverb neeklo-modelizmclub-worker

echo "NEEKLO_SETUP_DONE"
