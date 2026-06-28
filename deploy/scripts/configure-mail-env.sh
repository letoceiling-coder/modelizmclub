#!/usr/bin/env bash
# Configure SMTP mail settings in backend/.env on the VPS.
# Secrets are passed via environment variables (never commit credentials to git).
#
# Usage (on the server):
#   MAIL_USERNAME='info@modelizmclub.ru' \
#   MAIL_PASSWORD='********' \
#   bash deploy/scripts/configure-mail-env.sh
#
# Defaults target Beget SMTP (smtp.beget.com). Override via env vars as needed.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/modelizmclub/backend/.env}"

: "${MAIL_USERNAME:?Set MAIL_USERNAME}"
: "${MAIL_PASSWORD:?Set MAIL_PASSWORD}"

MAIL_MAILER="${MAIL_MAILER:-smtp}"
MAIL_HOST="${MAIL_HOST:-smtp.beget.com}"
MAIL_PORT="${MAIL_PORT:-465}"
MAIL_ENCRYPTION="${MAIL_ENCRYPTION:-ssl}"
MAIL_FROM_ADDRESS="${MAIL_FROM_ADDRESS:-$MAIL_USERNAME}"
MAIL_FROM_NAME="${MAIL_FROM_NAME:-МоДелизМ Клуб}"
MAIL_EHLO_DOMAIN="${MAIL_EHLO_DOMAIN:-modelizmclub.ru}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ENV file not found: $ENV_FILE" >&2
  exit 1
fi

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

# Drop any existing MAIL_* keys, then append a fresh block.
grep -vE '^(MAIL_MAILER|MAIL_HOST|MAIL_PORT|MAIL_USERNAME|MAIL_PASSWORD|MAIL_ENCRYPTION|MAIL_FROM_ADDRESS|MAIL_FROM_NAME|MAIL_EHLO_DOMAIN)=' \
  "$ENV_FILE" > "${ENV_FILE}.tmp" || true
mv "${ENV_FILE}.tmp" "$ENV_FILE"

{
  printf 'MAIL_MAILER=%s\n' "$MAIL_MAILER"
  printf 'MAIL_HOST=%s\n' "$MAIL_HOST"
  printf 'MAIL_PORT=%s\n' "$MAIL_PORT"
  printf 'MAIL_USERNAME=%s\n' "$MAIL_USERNAME"
  printf 'MAIL_PASSWORD="%s"\n' "$MAIL_PASSWORD"
  printf 'MAIL_ENCRYPTION=%s\n' "$MAIL_ENCRYPTION"
  printf 'MAIL_FROM_ADDRESS=%s\n' "$MAIL_FROM_ADDRESS"
  printf 'MAIL_FROM_NAME="%s"\n' "$MAIL_FROM_NAME"
  printf 'MAIL_EHLO_DOMAIN=%s\n' "$MAIL_EHLO_DOMAIN"
} >> "$ENV_FILE"

cd "$(dirname "$ENV_FILE")"
php artisan config:clear
php artisan config:cache

echo "Mail configured: ${MAIL_MAILER} via ${MAIL_HOST}:${MAIL_PORT} (${MAIL_ENCRYPTION}) as ${MAIL_USERNAME}"
