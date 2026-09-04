#!/usr/bin/env bash
# Deploy SMS phone verification + iqsms credentials on production.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
cd "$APP_DIR/backend"

LOGIN="${1:-${IQSMS_LOGIN:-}}"
PASS="${2:-${IQSMS_PASSWORD:-}}"

if [[ -z "$LOGIN" || -z "$PASS" ]]; then
  echo "Usage: IQSMS_LOGIN=... IQSMS_PASSWORD=... $0" >&2
  echo "   or: $0 login password" >&2
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

set_env SMS_DRIVER iqsms
set_env IQSMS_ACCESS_POINT https://api.iqsms.ru
set_env IQSMS_LOGIN "$LOGIN"
set_env IQSMS_PASSWORD "$PASS"
set_env IQSMS_SENDER ModelizmClub

php artisan migrate --force

# Append iqsms vars if missing (credentials passed via env or args)
# REMOVED duplicate block

php artisan optimize:clear
php artisan test --filter=PhoneVerificationTest

echo "SMS phone verification deployed."
