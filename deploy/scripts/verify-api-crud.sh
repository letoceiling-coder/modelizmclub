#!/usr/bin/env bash
# Verify core API CRUD flows against dev (or BASE_URL).
set -euo pipefail

BASE="${BASE_URL:-https://dev.modelizmclub.ru}"
EMAIL="${SMOKE_EMAIL:-demo@modelizmclub.ru}"
PASSWORD="${SMOKE_PASSWORD:-password123}"
FAIL=0

check() {
  local name="$1"
  local code="$2"
  local expect="$3"
  if [[ "${code}" == "${expect}" ]]; then
    echo "  OK ${name} (${code})"
  else
    echo "  FAIL ${name} (expected ${expect}, got ${code})" >&2
    FAIL=1
  fi
}

echo "==> Health"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "${BASE}/api/v1/health")
check "GET /health" "${CODE}" "200"

echo "==> Auth login"
LOGIN=$(curl -sS -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  "${BASE}/api/v1/auth/login")
TOKEN=$(echo "${LOGIN}" | php -r '$j=json_decode(file_get_contents("php://stdin"),true); echo $j["meta"]["token"]??"";')
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  "${BASE}/api/v1/auth/login")
check "POST /auth/login" "${CODE}" "200"

if [[ -z "${TOKEN}" ]]; then
  echo "No token — aborting authenticated checks" >&2
  exit 1
fi

AUTH=(-H "Authorization: Bearer ${TOKEN}" -H 'Accept: application/json')

echo "==> Auth me (R)"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/auth/me")
check "GET /auth/me" "${CODE}" "200"

echo "==> Catalog (R)"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/categories/posts")
check "GET /categories/posts" "${CODE}" "200"

echo "==> Communities (R)"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/communities")
check "GET /communities" "${CODE}" "200"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/communities/modelizmclub")
check "GET /communities/{slug}" "${CODE}" "200"

echo "==> Users profile (R/U)"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/users/demo-user")
check "GET /users/{slug}" "${CODE}" "200"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"bio":"API CRUD verify"}' "${BASE}/api/v1/users/me")
check "PATCH /users/me" "${CODE}" "200"

echo "==> Posts CRUD"
CAT_ID=$(curl -sS "${AUTH[@]}" "${BASE}/api/v1/categories/posts" \
  | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["data"][0]["id"]??"";')

POST=$(curl -sS "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"CRUD verify\",\"body\":\"Test body\",\"category_id\":${CAT_ID}}" \
  "${BASE}/api/v1/posts")
UUID=$(echo "${POST}" | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["data"]["uuid"]??"";')
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"title\":\"CRUD verify\",\"body\":\"Test body\",\"category_id\":${CAT_ID}}" \
  "${BASE}/api/v1/posts")
check "POST /posts (C)" "${CODE}" "201"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/posts/${UUID}")
check "GET /posts/{uuid} (R)" "${CODE}" "200"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"CRUD verify updated"}' "${BASE}/api/v1/posts/${UUID}")
check "PATCH /posts/{uuid} (U)" "${CODE}" "200"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${AUTH[@]}" "${BASE}/api/v1/posts/${UUID}/publish")
check "POST /posts/{uuid}/publish" "${CODE}" "200"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${BASE}/api/v1/feed")
check "GET /feed (R)" "${CODE}" "200"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body":"CRUD comment"}' "${BASE}/api/v1/posts/${UUID}/comments")
check "POST /posts/{uuid}/comments (C)" "${CODE}" "201"

CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "${AUTH[@]}" "${BASE}/api/v1/posts/${UUID}")
check "DELETE /posts/{uuid} (D)" "${CODE}" "200"

echo "==> OpenAPI docs"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/docs/api")
check "GET /docs/api (Swagger UI)" "${CODE}" "200"

if [[ "${FAIL}" -ne 0 ]]; then
  echo "Some checks failed" >&2
  exit 1
fi

echo "All API CRUD checks passed."
