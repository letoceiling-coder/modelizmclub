#!/usr/bin/env bash
# Согласовать .env с СМС Дисконт (iqsms) без смены логина/пароля.
set -euo pipefail
cd "${APP_DIR:-/var/www/modelizmclub}/backend"
ENV=.env
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV"
  else
    echo "${key}=${val}" >> "$ENV"
  fi
}
set_env SMS_DRIVER iqsms
grep -q '^SMS_CODE_LENGTH=' "$ENV" || echo 'SMS_CODE_LENGTH=6' >> "$ENV"
set_env SMS_CODE_LENGTH 6
grep -q '^IQSMS_MOBILE_ID_ENABLED=' "$ENV" || echo 'IQSMS_MOBILE_ID_ENABLED=true' >> "$ENV"
grep -q '^IQSMS_STATUS_CALLBACK_URL=' "$ENV" || echo 'IQSMS_STATUS_CALLBACK_URL=https://api.modelizmclub.ru/api/v1/webhooks/iqsms/mobile-id' >> "$ENV"
grep -q '^IQSMS_OTP_CODE_LENGTH=' "$ENV" || echo 'IQSMS_OTP_CODE_LENGTH=4' >> "$ENV"
grep -q '^IQSMS_POLL_INTERVAL_SECONDS=' "$ENV" || echo 'IQSMS_POLL_INTERVAL_SECONDS=2' >> "$ENV"
if ! grep -q '^IQSMS_WEBHOOK_SECRET=.' "$ENV" 2>/dev/null; then
  echo "IQSMS_WEBHOOK_SECRET=$(openssl rand -hex 16)" >> "$ENV"
fi
sed -i '/^IQSMS_SENDER=/d' "$ENV"
echo 'IQSMS_SENDER=' >> "$ENV"
chown root:www-data "$ENV"
chmod 640 "$ENV"
sudo -u www-data php artisan config:cache
chmod 640 bootstrap/cache/config.php
chown root:www-data bootstrap/cache/config.php
systemctl reload php8.3-fpm
echo "SMS env: driver=iqsms, empty IQSMS_SENDER, config cached"
