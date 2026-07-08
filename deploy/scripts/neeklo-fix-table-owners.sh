#!/usr/bin/env bash
set -euo pipefail
DB_NAME="${DB_NAME:-modelizmclub_neeklo}"
DB_USER="${DB_USER:-modelizmclub_neeklo}"

sudo -u postgres psql -d "${DB_NAME}" -t -A -c \
  "SELECT 'ALTER TABLE ' || quote_ident(tablename) || ' OWNER TO ${DB_USER};' FROM pg_tables WHERE schemaname = 'public';" \
  | sudo -u postgres psql -d "${DB_NAME}"

echo "Table owners reassigned to ${DB_USER}"
