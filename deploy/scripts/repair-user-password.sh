#!/usr/bin/env bash
# Repair specific user password via API reset (admin diagnostic).
set -euo pipefail
EMAIL="${1:-crandimandi@gmail.com}"
NEW_PASS="${2:-TempFix2026!Secure}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"
cd "$APP_DIR/backend"

PLAIN=$(php artisan tinker --execute="
\$u = App\\Models\\User::where('email', '$EMAIL')->first();
if (! \$u) { echo 'NO_USER'; exit; }
echo Illuminate\\Support\\Facades\\Password::createToken(\$u);
" | tail -1)

if [[ "$PLAIN" == "NO_USER" ]]; then echo "user not found"; exit 1; fi

echo "Resetting $EMAIL ..."
RESET=$(curl -sS -w '\nHTTP:%{http_code}' -X POST "$API/auth/reset-password" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"token\":\"$PLAIN\",\"password\":\"$NEW_PASS\",\"password_confirmation\":\"$NEW_PASS\"}")
echo "$RESET" | head -c 300

echo
echo "Login test..."
curl -sS -w '\nHTTP:%{http_code}\n' -X POST "$API/auth/login" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}" | head -c 300
