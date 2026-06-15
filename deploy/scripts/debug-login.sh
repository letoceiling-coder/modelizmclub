#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' '{"email":"demo@modelizmclub.ru","password":"password123"}' > /tmp/login.json
curl -sS -w "\nHTTP:%{http_code}\n" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d @/tmp/login.json \
  https://dev.modelizmclub.ru/api/v1/auth/login
