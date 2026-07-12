#!/usr/bin/env bash
# Smoke-test public frontend SSR routes (modelizmclub.ru).
set -euo pipefail

BASE="${FRONTEND_BASE:-https://modelizmclub.ru}"
PASS=0
FAIL=0

check() {
  local path="$1"
  local name="$2"
  local code
  code=$(curl -sS -o /tmp/smoke_fe_body -w "%{http_code}" "${BASE}${path}" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "OK  [$code] $path — $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL [$code] expected 200 — $path — $name"
    head -c 200 /tmp/smoke_fe_body 2>/dev/null; echo
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Public frontend routes ($BASE)"
check "/" "landing"
check "/ads" "catalog"
check "/feed" "feed"
check "/reviews" "reviews"
check "/channels" "channels"
check "/communities" "communities"
check "/messenger" "messenger"
check "/friends" "friends"
check "/login" "login"
check "/register" "register"
check "/subscription" "subscription"
check "/help" "help"
check "/profile" "profile"
check "/my-ads" "my-ads"
check "/settings" "settings"
check "/settings/dashboard" "settings-dashboard"
check "/settings/account" "settings-account"
check "/settings/wallet" "settings-wallet"
check "/settings/notifications" "settings-notifications"
check "/settings/payment-methods" "settings-payment-methods"
check "/settings/security" "settings-security"
check "/diag" "diag"

echo ""
echo "=== Frontend smoke: ${PASS} passed, ${FAIL} failed ==="
[[ "$FAIL" -eq 0 ]]
