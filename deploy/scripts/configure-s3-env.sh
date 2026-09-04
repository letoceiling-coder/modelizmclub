#!/usr/bin/env bash
# Configure Selectel S3 in backend/.env on VPS.
# Secrets are passed via environment variables (never commit keys to git).
set -euo pipefail

ENV_FILE="/var/www/modelizmclub/backend/.env"

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
: "${AWS_BUCKET:?Set AWS_BUCKET}"
: "${AWS_DEFAULT_REGION:?Set AWS_DEFAULT_REGION}"
: "${AWS_ENDPOINT:?Set AWS_ENDPOINT}"

set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

set_env AWS_ACCESS_KEY_ID "${AWS_ACCESS_KEY_ID}"
set_env AWS_SECRET_ACCESS_KEY "${AWS_SECRET_ACCESS_KEY}"
set_env AWS_BUCKET "${AWS_BUCKET}"
set_env AWS_DEFAULT_REGION "${AWS_DEFAULT_REGION}"
set_env AWS_ENDPOINT "${AWS_ENDPOINT}"
set_env AWS_USE_PATH_STYLE_ENDPOINT "${AWS_USE_PATH_STYLE_ENDPOINT:-true}"
set_env FILESYSTEM_DISK s3

cd /var/www/modelizmclub/backend
php artisan config:clear
php artisan storage:verify-s3
php artisan config:cache

echo "S3 configured for bucket: ${AWS_BUCKET}"
