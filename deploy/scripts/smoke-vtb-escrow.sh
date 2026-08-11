#!/usr/bin/env bash
# Smoke-test VTB sandbox + escrow checkout on production API.
set -euo pipefail

API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"
APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

echo "=== VTB + Escrow smoke ==="

echo "--- VTB register.do ---"
php "${APP_DIR}/deploy/scripts/test-vtb-register.php" | tee /tmp/vtb-register.out
if grep -q '"orderId"' /tmp/vtb-register.out; then
  echo "OK  VTB API credentials work"
else
  echo "FAIL VTB register"
  exit 1
fi

echo "--- Feature flags ---"
FLAGS=$(curl -sf "${API}/public/feature-flags")
echo "$FLAGS" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; assert d.get('escrow_enabled'), 'escrow disabled'; print('OK  escrow_enabled=true')" \
  || { echo "WARN escrow_enabled=false — enable in Admin → Settings"; }

login() {
  curl -sf "${API}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['token'])"
}

TOKEN=$(login "demo@modelizmclub.ru" 2>/dev/null || true)
if [[ -z "${TOKEN:-}" ]]; then
  echo "SKIP demo login (no demo user)"
  exit 0
fi
echo "OK  demo login"

ME_ID=$(curl -sf "${API}/users/me" -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

LISTING=$(curl -sf "${API}/listings?per_page=20" -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import sys,json
me='$ME_ID'
for row in json.load(sys.stdin).get('data',[]):
    if row.get('seller',{}).get('id') != me and (row.get('price_cents') or 0) > 0:
        print(row['id']); break
")

if [[ -z "${LISTING:-}" ]]; then
  echo "SKIP no foreign listing for checkout test"
  exit 0
fi
echo "OK  listing ${LISTING}"

QUOTE=$(curl -sf "${API}/escrow/quote?listing_uuid=${LISTING}&delivery_cents=0")
echo "$QUOTE" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; assert d.get('provider')=='vtb'; print('OK  quote provider=vtb')"

RESP=$(curl -sf -X POST "${API}/listings/${LISTING}/escrow/checkout" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' -d '{}')
echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
url=d.get('checkout_url') or ''
assert 'vtb.rbsuat.com' in url, url
assert d.get('provider')=='vtb'
print('OK  checkout_url:', url[:80]+'...')
"

echo "=== VTB escrow smoke passed ==="
