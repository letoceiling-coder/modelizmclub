#!/usr/bin/env bash
# Production coturn for turn.modelizmclub.ru (TLS + UDP), wired to Laravel CALLS_TURN_*.
set -euo pipefail

APP_ENV="/var/www/modelizmclub/backend/.env"
REALM="modelizmclub.ru"
TURN_HOST="turn.modelizmclub.ru"
MIN_PORT=49152
MAX_PORT=65535
CERT_DIR="/etc/letsencrypt/live/${TURN_HOST}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y coturn certbot

PUBLIC_IP="$(curl -s --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
echo "Public IP: ${PUBLIC_IP}"

if grep -q '^CALLS_TURN_SECRET=' "${APP_ENV}" 2>/dev/null; then
  SECRET="$(grep '^CALLS_TURN_SECRET=' "${APP_ENV}" | head -n1 | cut -d= -f2-)"
fi
if [[ -z "${SECRET:-}" ]]; then
  SECRET="$(openssl rand -hex 32)"
fi

# TLS cert for turns: (required on many mobile networks).
if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo "Obtaining TLS cert for ${TURN_HOST}..."
  systemctl stop coturn 2>/dev/null || true
  certbot certonly --standalone -d "${TURN_HOST}" \
    --non-interactive --agree-tos --register-unsafely-without-email || true
  systemctl start coturn 2>/dev/null || true
fi

TLS_BLOCK=""
if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
  install -d -m 0750 -o turnserver -g turnserver /etc/coturn
  cp "${CERT_DIR}/fullchain.pem" /etc/coturn/turn.crt
  cp "${CERT_DIR}/privkey.pem" /etc/coturn/turn.key
  chown turnserver:turnserver /etc/coturn/turn.crt /etc/coturn/turn.key
  chmod 640 /etc/coturn/turn.key
  TLS_BLOCK=$(
    cat <<TLS
tls-listening-port=5349
cert=/etc/coturn/turn.crt
pkey=/etc/coturn/turn.key
no-tlsv1
no-tlsv1_1
TLS
  )
fi

cat > /etc/turnserver.conf <<EOF
listening-port=3478
${TLS_BLOCK}
listening-ip=0.0.0.0
relay-ip=${PUBLIC_IP}
external-ip=${PUBLIC_IP}
realm=${REALM}
server-name=${TURN_HOST}

fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${SECRET}

stale-nonce=600
no-loopback-peers
no-multicast-peers
no-cli

min-port=${MIN_PORT}
max-port=${MAX_PORT}
max-bps=3000000
total-quota=200
user-quota=10

log-file=/var/log/turnserver/turnserver.log
verbose
simple-log
no-stdout-log
EOF

mkdir -p /var/log/turnserver
chown turnserver:turnserver /var/log/turnserver 2>/dev/null || true

if [[ -f /etc/default/coturn ]]; then
  sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn || echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
else
  echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn
fi

systemctl enable coturn
systemctl restart coturn

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 3478/udp || true
  ufw allow 3478/tcp || true
  ufw allow 5349/tcp || true
  ufw allow 5349/udp || true
  ufw allow ${MIN_PORT}:${MAX_PORT}/udp || true
fi

TURN_URLS="turn:${TURN_HOST}:3478?transport=udp"
if [[ -n "${TLS_BLOCK}" ]]; then
  TURN_URLS="${TURN_URLS},turns:${TURN_HOST}:5349?transport=tcp"
fi

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${APP_ENV}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${APP_ENV}"
  else
    echo "${key}=${val}" >> "${APP_ENV}"
  fi
}

set_env "CALLS_TURN_SECRET" "${SECRET}"
set_env "CALLS_TURN_URLS" "${TURN_URLS}"
set_env "CALLS_TURN_TTL" "3600"
set_env "CALLS_STUN_URLS" "stun:${TURN_HOST}:3478,stun:stun.l.google.com:19302"

cd /var/www/modelizmclub/backend
php artisan config:clear
php artisan config:cache

systemctl is-active coturn && echo "COTURN_OK"
ss -tlnup | grep -E '3478|5349' || true
