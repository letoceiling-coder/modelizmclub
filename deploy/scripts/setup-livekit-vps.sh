#!/usr/bin/env bash
# Install & configure LiveKit SFU for group calls on modelizmclub.ru.
# - livekit-server via systemd
# - HTTP/WS bound to 127.0.0.1:7880 (nginx terminates TLS for wss)
# - media on tcp 7881 / udp 7882 (single-port mux, outside coturn's 49152-65535)
# - writes LIVEKIT_* into backend/.env and nginx vhost livekit.modelizmclub.ru
set -euo pipefail

APP_ENV="/var/www/modelizmclub/backend/.env"
LK_HOST="livekit.modelizmclub.ru"
LK_DIR="/etc/livekit"
CERT_DIR="/etc/letsencrypt/live/${LK_HOST}"

PUBLIC_IP="$(curl -s --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
echo "Public IP: ${PUBLIC_IP}"

# 1) Binary
if ! command -v livekit-server >/dev/null 2>&1; then
  echo "Installing livekit-server..."
  curl -sSL https://get.livekit.io | bash
fi

# 2) Keys (reuse existing from .env if present)
LK_KEY="$(grep '^LIVEKIT_API_KEY=' "${APP_ENV}" 2>/dev/null | head -n1 | cut -d= -f2- || true)"
LK_SECRET="$(grep '^LIVEKIT_API_SECRET=' "${APP_ENV}" 2>/dev/null | head -n1 | cut -d= -f2- || true)"
if [[ -z "${LK_KEY}" ]]; then LK_KEY="API$(openssl rand -hex 6)"; fi
if [[ -z "${LK_SECRET}" ]]; then LK_SECRET="$(openssl rand -hex 32)"; fi

# 3) Config
install -d -m 0755 "${LK_DIR}"
cat > "${LK_DIR}/livekit.yaml" <<EOF
port: 7880
bind_addresses:
  - 127.0.0.1
log_level: info
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  external_ip: ${PUBLIC_IP}
keys:
  ${LK_KEY}: ${LK_SECRET}
EOF

# 4) systemd unit
cat > /etc/systemd/system/livekit.service <<'EOF'
[Unit]
Description=LiveKit SFU server
After=network.target

[Service]
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit/livekit.yaml
Restart=on-failure
RestartSec=2
LimitNOFILE=500000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable livekit
systemctl restart livekit

# 5) TLS cert for the wss subdomain (HTTP-01 via nginx on :80)
if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  certbot certonly --nginx -d "${LK_HOST}" \
    --non-interactive --agree-tos --register-unsafely-without-email || \
  certbot certonly --webroot -w /var/www/html -d "${LK_HOST}" \
    --non-interactive --agree-tos --register-unsafely-without-email || true
fi

# 6) nginx vhost
cat > /etc/nginx/sites-available/${LK_HOST} <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${LK_HOST};

    ssl_certificate     /etc/letsencrypt/live/${LK_HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${LK_HOST}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${LK_HOST};
    return 301 https://\$host\$request_uri;
}
EOF
ln -sf /etc/nginx/sites-available/${LK_HOST} /etc/nginx/sites-enabled/${LK_HOST}
nginx -t && systemctl reload nginx

# 7) Persist keys into backend/.env
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${APP_ENV}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${APP_ENV}"
  else
    echo "${key}=${val}" >> "${APP_ENV}"
  fi
}
set_env "LIVEKIT_API_KEY" "${LK_KEY}"
set_env "LIVEKIT_API_SECRET" "${LK_SECRET}"
set_env "LIVEKIT_URL" "wss://${LK_HOST}"

cd /var/www/modelizmclub/backend
php artisan config:clear
php artisan config:cache

echo "--- status ---"
systemctl is-active livekit && echo "LIVEKIT_OK"
ss -tlnup | grep -E '7880|7881|7882' || true
echo "LIVEKIT_URL=wss://${LK_HOST}"
echo "LIVEKIT_API_KEY=${LK_KEY}"
