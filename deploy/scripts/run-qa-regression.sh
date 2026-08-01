#!/usr/bin/env bash
# Task 43 — final QA regression (prod): SSR routes + API smoke + Playwright browser QA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> 1/3 Frontend SSR routes"
bash deploy/scripts/smoke-frontend-routes.sh

echo ""
echo "==> 2/3 Prod release API smoke"
bash deploy/scripts/smoke-prod-release.sh

echo ""
echo "==> 3/3 Playwright browser QA"
if [[ ! -d deploy/node_modules/playwright ]]; then
  echo "Installing Playwright in deploy/ (first run)…"
  (cd deploy && npm install --no-audit --no-fund)
  (cd deploy && npx playwright install chromium)
fi
(cd deploy && npm run qa)

echo ""
echo "=== QA regression complete ==="
