#!/usr/bin/env bash
# Regenerate OpenAPI locally/CI and fail if docs drift from committed version.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

bash deploy/scripts/export-openapi.sh

if ! git diff --quiet -- docs/openapi/openapi.json; then
  echo "ERROR: docs/openapi/openapi.json is out of date. Run export-openapi.sh and commit." >&2
  git diff --stat -- docs/openapi/openapi.json >&2 || true
  exit 1
fi

echo "OpenAPI spec is up to date."
