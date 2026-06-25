#!/usr/bin/env bash
# One-time: Node.js 22 + Bun + nginx vhost + SSL for modelizmclub.ru frontend.
# Does NOT modify dev.modelizmclub.ru backend or other vhosts.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
DOMAIN="modelizmclub.ru"
WWW_DOMAIN="www.modelizmclub.ru"
CERT_EMAIL="${CERT_EMAIL:-admin@modelizmclub.ru}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

echo "==> Node.js 22 (if missing)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Bun (if missing)"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
fi
bun -v

echo "==> systemd unit"
cp "${APP_DIR}/deploy/systemd/modelizmclub-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable modelizmclub-frontend.service

echo "==> nginx HTTP vhost (${DOMAIN})"
cp "${APP_DIR}/deploy/nginx/${DOMAIN}.http.conf" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

echo "==> build frontend (first deploy)"
bash "${APP_DIR}/deploy/scripts/deploy-frontend.sh"

echo "==> Let's Encrypt"
if ! certbot certificates 2>/dev/null | grep -q "Certificate Name: ${DOMAIN}"; then
  certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
    --non-interactive --agree-tos -m "${CERT_EMAIL}" --redirect || true
fi

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  cp "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}"
  nginx -t && systemctl reload nginx
  echo "SSL OK: https://${DOMAIN}/"
else
  echo "WARN: cert not issued yet — site available on http://${DOMAIN}/"
fi

echo "Setup frontend OK."
