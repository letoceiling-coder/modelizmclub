#!/usr/bin/env bash
set -euo pipefail

cat > /tmp/register.json <<'EOF'
{"email":"demo@modelizmclub.ru","password":"password123","password_confirmation":"password123","registration_track":"community","display_name":"Demo User"}
EOF

echo "==> register"
REGISTER=$(curl -sS -X POST https://dev.modelizmclub.ru/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d @/tmp/register.json)
echo "$REGISTER"

CODE=$(cd /var/www/modelizmclub/backend && php artisan tinker --execute="echo App\\Models\\EmailVerificationCode::whereHas('user', fn(\$q) => \$q->where('email','demo@modelizmclub.ru'))->value('code');")
echo "==> code: $CODE"

cat > /tmp/verify.json <<EOF
{"email":"demo@modelizmclub.ru","code":"${CODE}"}
EOF

echo "==> verify"
curl -sS -X POST https://dev.modelizmclub.ru/api/v1/auth/verify-email \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d @/tmp/verify.json

echo
