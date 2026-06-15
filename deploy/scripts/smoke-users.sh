#!/usr/bin/env bash
set -euo pipefail

cat > /tmp/login.json <<'EOF'
{"email":"demo@modelizmclub.ru","password":"password123"}
EOF

echo "==> login"
LOGIN=$(curl -sS -X POST https://dev.modelizmclub.ru/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d @/tmp/login.json)
echo "$LOGIN"

TOKEN=$(echo "$LOGIN" | php -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["token"] ?? "";')
SLUG=$(echo "$LOGIN" | php -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["user"]["profile"]["slug"] ?? "";')

if [[ -z "$TOKEN" || -z "$SLUG" ]]; then
  echo "login failed or profile missing"
  exit 1
fi

echo "==> public profile /users/$SLUG"
curl -sS -H 'Accept: application/json' "https://dev.modelizmclub.ru/api/v1/users/$SLUG"
echo

echo "==> patch profile"
curl -sS -X PATCH https://dev.modelizmclub.ru/api/v1/users/me \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"bio":"ModelizmClub demo profile"}'
echo

echo "==> settings"
curl -sS -H 'Accept: application/json' -H "Authorization: Bearer $TOKEN" \
  https://dev.modelizmclub.ru/api/v1/users/me/settings
echo
