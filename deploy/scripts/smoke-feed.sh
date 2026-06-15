#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-https://dev.modelizmclub.ru}"
EMAIL="${SMOKE_EMAIL:-demo@modelizmclub.ru}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

echo "==> login"
TOKEN=$(curl -sS -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  "${BASE}/api/v1/auth/login" | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["meta"]["token"]??"";')

if [[ -z "${TOKEN}" ]]; then
  echo "login failed"
  exit 1
fi

AUTH=(-H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/json')

echo "==> categories (pick first id)"
CAT_ID=$(curl -sS "${AUTH[@]}" "${BASE}/api/v1/categories/posts" \
  | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["data"][0]["id"]??"";')

if [[ -z "${CAT_ID}" ]]; then
  echo "no categories"
  exit 1
fi

echo "==> create post"
POST_JSON=$(curl -sS "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Smoke test post\",\"body\":\"Automated feed smoke.\",\"category_id\":${CAT_ID}}" \
  "${BASE}/api/v1/posts")
echo "${POST_JSON}" | head -c 400
echo

UUID=$(echo "${POST_JSON}" | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["data"]["uuid"]??"";')

echo "==> publish"
curl -sS -X POST "${AUTH[@]}" "${BASE}/api/v1/posts/${UUID}/publish" | head -c 400
echo

echo "==> feed"
curl -sS "${AUTH[@]}" "${BASE}/api/v1/feed" | head -c 500
echo

echo "==> comment"
curl -sS -X POST "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body":"Smoke comment"}' \
  "${BASE}/api/v1/posts/${UUID}/comments" | head -c 300
echo

echo "OK"
