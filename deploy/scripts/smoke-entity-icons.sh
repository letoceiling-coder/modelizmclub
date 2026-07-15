#!/usr/bin/env bash
# Smoke-test §26 (icon assets/overrides) and §27 (entity applications) routes.
set -euo pipefail

API="${API_BASE:-https://api.modelizmclub.ru/api/v1}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local expect="$2"
  local method="$3"
  local path="$4"
  local body="${5:-}"

  local args=(-sS -o /tmp/smoke_body -w "%{http_code}" -X "$method" "${API}${path}")
  args+=(-H 'Accept: application/json' -H 'Content-Type: application/json')
  if [[ -n "${TOKEN:-}" ]]; then
    args+=(-H "Authorization: Bearer ${TOKEN}")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local code
  code=$(curl "${args[@]}" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" || ",$expect," == *",$code,"* ]]; then
    echo "OK  [$code] $method $path — $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$code] expected $expect — $method $path — $name"
    head -c 300 /tmp/smoke_body 2>/dev/null; echo
    FAIL=$((FAIL + 1))
  fi
}

login() {
  curl -sS -X POST "${API}/auth/login" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('token','') or d.get('data',{}).get('token',''))" 2>/dev/null || true
}

echo "==> Public"
check "icon-overrides" 200 GET "/icon-overrides"
FLAGS=$(curl -sS "${API}/public/feature-flags" -H 'Accept: application/json')
if echo "$FLAGS" | grep -q 'escrow_enabled' && echo "$FLAGS" | grep -q 'market_enabled'; then
  echo "OK  feature-flags contains market_enabled + escrow_enabled"
  PASS=$((PASS + 1))
else
  echo "FAIL feature-flags missing new keys: $FLAGS"
  FAIL=$((FAIL + 1))
fi

echo "==> Demo user (auth)"
TOKEN=$(login "demo@modelizmclub.ru")
if [[ -z "$TOKEN" ]]; then
  echo "FATAL: cannot obtain demo token"
  exit 1
fi
check "me-entity-requests" 200 GET "/me/entity-requests"
# 201 first run, 422 afterwards (pending guard) — both mean the route is live.
check "channels-apply (201|422)" "201,422" POST "/channels/apply" '{"name":"Smoke channel","description":"smoke","category":"smoke"}'
check "communities-owned-filter" 200 GET "/communities?owned=1"

echo "==> Admin"
ADMIN_TOKEN=$(login "admin@modelizmclub.ru")
if [[ -n "$ADMIN_TOKEN" ]]; then
  TOKEN="$ADMIN_TOKEN"
  check "admin-community-applications" 200 GET "/admin/communities/applications"
  check "admin-community-applications-pending" 200 GET "/admin/communities/applications?status=pending"
  check "admin-channel-applications" 200 GET "/admin/channels/applications"
  check "admin-icon-assets" 200 GET "/admin/icon-assets"

  echo "==> Admin icon upload (multipart)"
  TMP_SVG=$(mktemp /tmp/smoke-icon-XXXX.svg)
  printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#112233"/></svg>' > "$TMP_SVG"
  UPLOAD=$(curl -sS -o /tmp/smoke_body -w "%{http_code}" -X POST "${API}/media" \
    -H 'Accept: application/json' -H "Authorization: Bearer ${TOKEN}" \
    -F 'purpose=icon' -F "file=@${TMP_SVG};type=image/svg+xml")
  if [[ "$UPLOAD" == "201" ]]; then
    echo "OK  [201] POST /media purpose=icon"
    PASS=$((PASS + 1))
    ASSET_ID=$(python3 -c "import json; print(json.load(open('/tmp/smoke_body'))['data']['id'])" 2>/dev/null || true)
    if python3 -c "import json,sys; d=json.load(open('/tmp/smoke_body'))['data']; sys.exit(0 if 'currentColor' in d['svg'] and '#112233' not in d['svg'] else 1)"; then
      echo "OK  icon svg tokenized to currentColor"
      PASS=$((PASS + 1))
    else
      echo "FAIL icon svg not tokenized"
      FAIL=$((FAIL + 1))
    fi
    if [[ -n "$ASSET_ID" ]]; then
      check "admin-icon-delete" 200 DELETE "/admin/icon-assets/${ASSET_ID}"
    fi
  else
    echo "FAIL [$UPLOAD] POST /media purpose=icon"
    head -c 300 /tmp/smoke_body 2>/dev/null; echo
    FAIL=$((FAIL + 1))
  fi
  rm -f "$TMP_SVG"
else
  echo "SKIP admin checks — no admin token"
fi

echo ""
echo "=== Smoke summary: ${PASS} passed, ${FAIL} failed ==="
[[ "$FAIL" -eq 0 ]]
