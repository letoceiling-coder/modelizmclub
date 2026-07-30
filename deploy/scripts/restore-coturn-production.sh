#!/usr/bin/env bash
# Restore coturn to the production config that worked before (49152-65535 relay range).
set -euo pipefail

APP_ENV="/var/www/modelizmclub/backend/.env"
TURN_HOST="turn.modelizmclub.ru"
PUBLIC_IP="$(curl -s --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
MIN_PORT=49152
MAX_PORT=65535

SECRET="$(grep '^CALLS_TURN_SECRET=' "${APP_ENV}" | cut -d= -f2- | tr -d '\"' | tr -d "'")"
[[ -n "${SECRET}" ]] || SECRET="$(grep '^static-auth-secret=' /etc/turnserver.conf | cut -d= -f2-)"
[[ -n "${SECRET}" ]] || { echo "CALLS_TURN_SECRET missing" >&2; exit 1; }

CERT_DIR="/etc/letsencrypt/live/${TURN_HOST}"
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
realm=modelizmclub.ru
server-name=${TURN_HOST}

fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${SECRET}

stale-nonce=600
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

systemctl restart coturn
sleep 1
systemctl is-active coturn

TURN_URLS="turn:${TURN_HOST}:3478?transport=udp,turn:${TURN_HOST}:3478?transport=tcp"
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
set_env "REVERB_HOST" "ws.modelizmclub.ru"

cd /var/www/modelizmclub/backend
php artisan config:clear
php artisan config:cache

echo "RESTORED: min-port=${MIN_PORT} max-port=${MAX_PORT}"
echo "Removed deprecated no-loopback-peers (coturn 4.6.1 warning)"
ss -tlnup | grep -E '3478|5349' | head -4
