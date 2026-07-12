#!/usr/bin/env bash
set -euo pipefail
DB_NAME="${DB_NAME:-modelizmclub_neeklo}"
TABLE="${1:-conversations}"

sudo -u postgres psql -d "${DB_NAME}" -c \
  "SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = '${TABLE}';"
