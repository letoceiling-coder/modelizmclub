#!/usr/bin/env bash
# Fix TURN/calls infra — delegates to restore-coturn-production.sh (keeps 49152-65535).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/restore-coturn-production.sh"
