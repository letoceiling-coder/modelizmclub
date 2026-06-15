#!/usr/bin/env bash
# Export OpenAPI spec from Laravel Scramble into docs/openapi/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}/backend"

php artisan scramble:export --no-interaction

if [[ -f "${ROOT}/docs/openapi/openapi.json" ]]; then
  echo "Exported: docs/openapi/openapi.json"
else
  echo "Export failed: openapi.json not found" >&2
  exit 1
fi
