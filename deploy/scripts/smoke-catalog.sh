#!/usr/bin/env bash
set -euo pipefail

echo "==> post categories"
curl -sS -H 'Accept: application/json' https://dev.modelizmclub.ru/api/v1/categories/posts | head -c 400
echo

echo "==> cities"
curl -sS -H 'Accept: application/json' 'https://dev.modelizmclub.ru/api/v1/cities?q=Моск' | head -c 300
echo

echo "==> communities"
curl -sS -H 'Accept: application/json' https://dev.modelizmclub.ru/api/v1/communities | head -c 400
echo

echo "==> community detail"
curl -sS -H 'Accept: application/json' https://dev.modelizmclub.ru/api/v1/communities/modelizmclub | head -c 400
echo
