#!/usr/bin/env bash
# One-time: Laravel Reverb systemd + nginx + SSL for ws.modelizmclub.ru
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
WS_DOMAIN="ws.modelizmclub.ru"
CERT_EMAIL="${CERT_EMAIL:-admin@modelizmclub.ru}"

echo "==> Reverb systemd"
cp "${APP_DIR}/deploy/systemd/modelizmclub-reverb.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable modelizmclub-reverb.service

echo "==> Ensure Reverb env in backend .env"
ENV_FILE="${APP_DIR}/backend/.env"
if ! grep -q '^BROADCAST_CONNECTION=' "${ENV_FILE}" 2>/dev/null; then
  echo 'BROADCAST_CONNECTION=reverb' >> "${ENV_FILE}"
fi
if ! grep -q '^REVERB_APP_ID=' "${ENV_FILE}" 2>/dev/null; then
  cd "${APP_DIR}/backend"
  php artisan reverb:install --no-interaction 2>/dev/null || true
fi

fuser -k 8080/tcp 2>/dev/null || true
systemctl restart modelizmclub-reverb.service
sleep 1
systemctl is-active modelizmclub-reverb.service

echo "==> nginx HTTP vhost (${WS_DOMAIN})"
cp "${APP_DIR}/deploy/nginx/${WS_DOMAIN}.http.conf" "/etc/nginx/sites-available/${WS_DOMAIN}"
ln -sf "/etc/nginx/sites-available/${WS_DOMAIN}" "/etc/nginx/sites-enabled/${WS_DOMAIN}"
nginx -t
systemctl reload nginx

echo "==> Let's Encrypt (${WS_DOMAIN})"
if ! certbot certificates 2>/dev/null | grep -q "Certificate Name: ${WS_DOMAIN}"; then
  certbot --nginx -d "${WS_DOMAIN}" \
    --non-interactive --agree-tos -m "${CERT_EMAIL}" --redirect || true
fi

if [[ -f "/etc/letsencrypt/live/${WS_DOMAIN}/fullchain.pem" ]]; then
  cp "${APP_DIR}/deploy/nginx/${WS_DOMAIN}.conf" "/etc/nginx/sites-available/${WS_DOMAIN}"
  nginx -t && systemctl reload nginx
  echo "SSL OK: wss://${WS_DOMAIN}/"
else
  echo "WARN: cert not issued — WebSocket proxy on http://${WS_DOMAIN}/"
fi

echo "Reverb setup OK."
