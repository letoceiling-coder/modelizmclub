#!/usr/bin/env bash
# Installs and configures coturn (TURN/STUN) for WebRTC calls, and wires the
# ephemeral-credential secret into the Laravel backend .env. Idempotent.
set -euo pipefail

APP_ENV="/var/www/modelizmclub/backend/.env"
REALM="modelizmclub.ru"
TURN_HOST="turn.modelizmclub.ru"
MIN_PORT=49160
MAX_PORT=49200

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y coturn

PUBLIC_IP="$(curl -s --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
echo "Public IP: ${PUBLIC_IP}"

# Reuse an existing secret if we already configured one, else generate.
if grep -q '^CALLS_TURN_SECRET=' "${APP_ENV}" 2>/dev/null; then
  SECRET="$(grep '^CALLS_TURN_SECRET=' "${APP_ENV}" | head -n1 | cut -d= -f2-)"
fi
if [[ -z "${SECRET:-}" ]]; then
  SECRET="$(openssl rand -hex 32)"
fi

cat > /etc/turnserver.conf <<EOF
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=${SECRET}
realm=${REALM}
server-name=${TURN_HOST}
listening-ip=0.0.0.0
external-ip=${PUBLIC_IP}
min-port=${MIN_PORT}
max-port=${MAX_PORT}
no-tcp-relay
no-cli
no-multicast-peers
stale-nonce=600
log-file=/var/log/turnserver.log
simple-log
EOF

# Enable the daemon.
if [[ -f /etc/default/coturn ]]; then
  if grep -q '^#\?TURNSERVER_ENABLED' /etc/default/coturn; then
    sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  else
    echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
  fi
else
  echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn
fi

systemctl enable coturn
systemctl restart coturn

# Open firewall ports when ufw is active.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 3478/udp || true
  ufw allow 3478/tcp || true
  ufw allow ${MIN_PORT}:${MAX_PORT}/udp || true
fi

# Wire the secret + URLs into the backend .env.
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${APP_ENV}" 2>/dev/null; then
    # Use a non-/ delimiter to be safe with URL values.
    sed -i "s|^${key}=.*|${key}=${val}|" "${APP_ENV}"
  else
    echo "${key}=${val}" >> "${APP_ENV}"
  fi
}

set_env "CALLS_TURN_SECRET" "${SECRET}"
set_env "CALLS_TURN_URLS" "turn:${TURN_HOST}:3478?transport=udp,turn:${TURN_HOST}:3478?transport=tcp"
set_env "CALLS_TURN_TTL" "3600"

cd /var/www/modelizmclub/backend
php artisan config:clear
php artisan config:cache

systemctl is-active coturn && echo "COTURN_OK"
