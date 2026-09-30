#!/usr/bin/env bash
# End-to-end password reset smoke on production API.
set -euo pipefail
# Пароли — из защищённого файла, как у остальных дымовых скриптов.
#
# Прежде начальный пароль стоял строкой прямо в теле tinker, а новый —
# умолчанием переменной. Учётка здесь расходная (`reset-smoke@…`), так
# что вреда живым людям не было, но источник пароля всё равно должен
# быть один: иначе при смене его правят в десяти местах и забывают в
# одиннадцатом — так и вышло.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/qa-secrets.sh"
QA_PASSWORD="$(qa_password)"

API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"
EMAIL="${1:-reset-smoke@example.com}"
# Новый пароль отличается от прежнего: смысл проверки в том, что он
# меняется. Берём тот же источник и приписываем признак.
NEW_PASS="${2:-${QA_PASSWORD}-reset}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

echo "=== ensure test user ==="
cd "$APP_DIR/backend"
QA_PASSWORD="${QA_PASSWORD}" php artisan tinker --execute="
\$email = '$EMAIL';
\$u = App\\Models\\User::firstOrCreate(['email' => \$email], [
  'name' => 'Reset Smoke',
  'password' => (string) getenv('QA_PASSWORD'),
  'status' => App\\Enums\\UserStatus::Active,
  'role' => App\\Enums\\UserRole::User,
  'email_verified_at' => now(),
]);
if (! \$u->email_verified_at) { \$u->forceFill(['email_verified_at' => now(), 'status' => App\\Enums\\UserStatus::Active])->save(); }
echo 'user_id='.\$u->id;
"

echo
echo "=== forgot-password ==="
curl -sS -X POST "$API/auth/forgot-password" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}"

echo
echo "=== read token from DB ==="
TOKEN=$(php artisan tinker --execute="
\$row = DB::table('password_reset_tokens')->where('email', '$EMAIL')->first();
echo \$row ? \$row->token : '';
" | tail -1)
# Laravel stores hashed token; we need plain token from Password::createToken
PLAIN=$(php artisan tinker --execute="
\$u = App\\Models\\User::where('email', '$EMAIL')->first();
echo Illuminate\\Support\\Facades\\Password::createToken(\$u);
" | tail -1)
echo "token_len=${#PLAIN}"

echo
echo "=== reset-password ==="
RESET=$(curl -sS -w '\nHTTP:%{http_code}' -X POST "$API/auth/reset-password" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"token\":\"$PLAIN\",\"password\":\"$NEW_PASS\",\"password_confirmation\":\"$NEW_PASS\"}")
echo "$RESET"

echo
echo "=== login new password ==="
LOGIN=$(curl -sS -w '\nHTTP:%{http_code}' -X POST "$API/auth/login" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}")
echo "$LOGIN" | head -c 400

echo
# Прежний пароль после сброса обязан перестать работать — это и есть
# смысл проверки. Берём его из того же источника, что и при создании.
echo "=== login old password (expect 422) ==="
OLD=$(curl -sS -w '\nHTTP:%{http_code}' -X POST "$API/auth/login" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"${QA_PASSWORD}\"}")
echo "$OLD" | head -c 200
