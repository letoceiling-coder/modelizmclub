#!/usr/bin/env bash
# Smoke-test YooKassa config + escrow routes on production.
set -euo pipefail

API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"

echo "=== YooKassa + Escrow smoke ==="

FLAGS=$(curl -sf "${API}/public/feature-flags")
echo "$FLAGS" | grep -q 'escrow_enabled' && echo "OK  feature-flags has escrow_enabled" || echo "FAIL feature-flags"

login() {
  curl -sf "${API}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['token'])"
}

TOKEN=$(login "demo@modelizmclub.ru")
echo "OK  demo login"

# Escrow checkout on a listing without seller card should 422
LISTING_UUID=$(curl -sf "${API}/listings?per_page=1" -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null || echo "")

if [[ -n "$LISTING_UUID" ]]; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${API}/listings/${LISTING_UUID}/escrow/checkout" \
    -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json')
  if [[ "$CODE" == "422" || "$CODE" == "403" ]]; then
    echo "OK  escrow/checkout responds $CODE (expected when seller has no card or own listing)"
  else
    echo "INFO escrow/checkout HTTP $CODE"
  fi
fi

# OAuth redirect should 302/503 depending on YANDEX_CLIENT_ID
OAUTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' "${API}/auth/oauth/yandex/redirect")
echo "INFO yandex oauth redirect HTTP $OAUTH_CODE (302=configured, 503=keys missing)"

echo "=== Done ==="
