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
sed -i '/^IQSMS_SENDER=/d' "$ENV"
echo 'IQSMS_SENDER=' >> "$ENV"
chown root:www-data "$ENV"
chmod 640 "$ENV"
sudo -u www-data php artisan config:cache
chmod 640 bootstrap/cache/config.php
chown root:www-data bootstrap/cache/config.php
systemctl reload php8.3-fpm
echo "SMS env: driver=iqsms, empty IQSMS_SENDER, config cached"
