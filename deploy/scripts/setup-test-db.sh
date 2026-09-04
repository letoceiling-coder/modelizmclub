#!/usr/bin/env bash
# Creates an isolated PostgreSQL database for PHPUnit (CRUD tests).
# Never run php artisan test against the production modelizmclub database.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"
DB_NAME="${DB_NAME:-modelizmclub_test}"
DB_USER="${DB_USER:-modelizmclub}"

if [[ -f /root/modelizmclub-db.env ]]; then
  # shellcheck disable=SC1091
  source /root/modelizmclub-db.env
fi

echo "==> PostgreSQL: test database ${DB_NAME}"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  echo "ERROR: PostgreSQL role ${DB_USER} not found" >&2
  exit 1
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "Created database ${DB_NAME}"
else
  echo "Database ${DB_NAME} already exists"
fi

sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};" >/dev/null

cd "${APP_DIR}/backend"

if [[ ! -f .env ]]; then
  echo "ERROR: ${APP_DIR}/backend/.env missing" >&2
  exit 1
fi

cp .env .env.testing
sed -i 's/^APP_ENV=.*/APP_ENV=testing/' .env.testing
sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_NAME}/" .env.testing

if grep -q '^FEED_AUTO_PUBLISH=' .env.testing; then
  sed -i 's/^FEED_AUTO_PUBLISH=.*/FEED_AUTO_PUBLISH=false/' .env.testing
else
  echo 'FEED_AUTO_PUBLISH=false' >> .env.testing
fi

if grep -q '^BILLING_PROVIDER=' .env.testing; then
  sed -i 's/^BILLING_PROVIDER=.*/BILLING_PROVIDER=stub/' .env.testing
else
  echo 'BILLING_PROVIDER=stub' >> .env.testing
fi

php artisan config:clear
echo "==> .env.testing ready (DB_DATABASE=${DB_NAME})"
echo "Run tests: bash deploy/scripts/run-backend-tests.sh"
