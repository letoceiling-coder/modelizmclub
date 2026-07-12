#!/usr/bin/env bash
# Smoke-test new API routes on production (api.modelizmclub.ru).
set -euo pipefail

API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local expect="$2"
  local method="$3"
  local path="$4"
  local extra="${5:-}"
  local body="${6:-}"

  local args=(-sS -o /tmp/smoke_body -w "%{http_code}" -X "$method" "${API}${path}")
  args+=(-H 'Accept: application/json' -H 'Content-Type: application/json')
  if [[ -n "${TOKEN:-}" ]]; then
    args+=(-H "Authorization: Bearer ${TOKEN}")
  fi
  if [[ -n "$extra" ]]; then
    args+=($extra)
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local code
  code=$(curl "${args[@]}" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "OK  [$code] $method $path — $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$code] expected $expect — $method $path — $name"
    head -c 300 /tmp/smoke_body 2>/dev/null; echo
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Public routes"
check "feature-flags" 200 GET "/public/feature-flags"
check "boost-packages" 200 GET "/listings/boost-packages"
check "video-categories" 200 GET "/videos/categories"
check "videos-index" 200 GET "/videos"

echo "==> Login demo user"
LOGIN=$(curl -sS -X POST "${API}/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"email":"demo@modelizmclub.ru","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('token','') or d.get('data',{}).get('token',''))" 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
  echo "WARN: demo login failed, seeding demo user..."
  bash "$(dirname "$0")/reset-demo-user.sh"
  LOGIN=$(curl -sS -X POST "${API}/auth/login" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    -d '{"email":"demo@modelizmclub.ru","password":"password123"}')
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('token','') or d.get('data',{}).get('token',''))" 2>/dev/null || true)
fi
if [[ -z "$TOKEN" ]]; then
  echo "FATAL: cannot obtain auth token"
  exit 1
fi
echo "Token OK (${#TOKEN} chars)"

echo "==> Account / wallet (auth)"
check "wallet" 200 GET "/wallet"
check "wallet-transactions" 200 GET "/wallet/transactions"
check "payment-methods" 200 GET "/account/payment-methods"
check "payout-requisites" 200 GET "/account/payout-requisites"
check "requisites" 200 GET "/account/requisites"
check "view-history" 200 GET "/me/view-history"
check "me-stats" 200 GET "/users/me/stats"
check "me-stats-views" 200 GET "/users/me/stats/views-daily"

echo "==> Account mutations (auth)"
check "change-password-wrong" 422 POST "/account/change-password" "" '{"current_password":"wrong","password":"newpass123","password_confirmation":"newpass123"}'
check "logout-others" 200 POST "/auth/logout-others" "" '{}'
check "payment-methods-bind" 422 POST "/account/payment-methods" "" '{}'

echo "==> User public"
USER_ID=$(curl -sS "${API}/users/me" -H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/json' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null || true)
if [[ -n "$USER_ID" ]]; then
  check "user-rating" 200 GET "/users/${USER_ID}/rating"
  check "user-reviews" 200 GET "/users/${USER_ID}/reviews"
else
  echo "SKIP user rating/reviews — no user id"
fi

echo "==> Listing reveal-phone (needs listing)"
LISTING_UUID=$(curl -sS "${API}/listings?per_page=1" -H 'Accept: application/json' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['uuid'] if items else '')" 2>/dev/null || true)
if [[ -n "$LISTING_UUID" ]]; then
  check "reveal-phone" 200 POST "/listings/${LISTING_UUID}/reveal-phone" "" '{}'
else
  echo "SKIP reveal-phone — no listings"
fi

echo "==> Media transcribe stub"
MEDIA_UUID=$(curl -sS "${API}/users/me" -H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/json' \
  | python3 -c "import sys,json; print('')" 2>/dev/null || true)
# transcribe requires real media uuid — expect 404 or 503
check "transcribe-missing" 404 POST "/media/00000000-0000-0000-0000-000000000099/transcribe" "" '{}'

echo "==> Admin payout requisites"
ADMIN_LOGIN=$(curl -sS -X POST "${API}/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"email":"admin@modelizmclub.ru","password":"password123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('token','') or d.get('data',{}).get('token',''))" 2>/dev/null || true)
if [[ -n "$ADMIN_TOKEN" && -n "$USER_ID" ]]; then
  OLD_TOKEN="$TOKEN"
  TOKEN="$ADMIN_TOKEN"
  check "admin-payout-requisites" 200 GET "/admin/users/${USER_ID}/payout-requisites"
  TOKEN="$OLD_TOKEN"
else
  echo "SKIP admin payout — no admin token or user id"
fi

echo ""
echo "=== Smoke summary: ${PASS} passed, ${FAIL} failed ==="
[[ "$FAIL" -eq 0 ]]
