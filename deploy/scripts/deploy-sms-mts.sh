#!/usr/bin/env bash
# Configure MTS Marketolog SMS on production (phone verification codes).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
cd "$APP_DIR/backend"

LOGIN="${1:-${MTS_LOGIN:-}}"
PASS="${2:-${MTS_PASSWORD:-}}"
SENDER="${3:-${MTS_SENDER:-}}"
AUTH="${MTS_AUTH:-basic}"

if [[ "$AUTH" == "basic" && ( -z "$LOGIN" || -z "$PASS" || -z "$SENDER" ) ]]; then
  echo "Usage: MTS_LOGIN=... MTS_PASSWORD=... MTS_SENDER=... $0" >&2
  echo "   or: $0 login password sender_name" >&2
  echo "For token auth: MTS_AUTH=token MTS_TOKEN=... MTS_SENDER=... $0" >&2
  exit 1
fi

if [[ "$AUTH" == "token" && ( -z "${MTS_TOKEN:-}" || -z "$SENDER" ) ]]; then
  echo "MTS_AUTH=token requires MTS_TOKEN and MTS_SENDER" >&2
  exit 1
fi

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

set_env SMS_DRIVER mts
set_env MTS_AUTH "$AUTH"
set_env MTS_SENDER "$SENDER"
set_env MTS_OMNICHANNEL_URL "${MTS_OMNICHANNEL_URL:-https://omnichannel.mts.ru/http-api/v1}"
set_env MTS_TOKEN_API_URL "${MTS_TOKEN_API_URL:-https://api.mts.ru/client-omni-adapter_production/1.0.2/mcom/messageManagement/messages}"

if [[ "$AUTH" == "token" ]]; then
  set_env MTS_TOKEN "${MTS_TOKEN}"
else
  set_env MTS_LOGIN "$LOGIN"
  set_env MTS_PASSWORD "$PASS"
fi

php artisan config:clear
php artisan config:cache
# Кеш конфига — это запечённый .env: пароль базы внутри открытым текстом.
# `config:cache` создаёт файл с умолчательными 644, то есть открывает его
# любому пользователю сервера. Возвращаем 640 сразу, иначе следующая выкатка
# молча отменяет починку прав (см. deploy/README.md, «Доступ к .env»).
chmod 640 bootstrap/cache/config.php 2>/dev/null || true

php artisan test --filter=MtsMarketologSmsClientTest

echo "MTS SMS configured (driver=mts, auth=${AUTH}, sender=${SENDER})."
echo "Test from site: Settings → Account → Send SMS verification."
