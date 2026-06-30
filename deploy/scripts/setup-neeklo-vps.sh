#!/usr/bin/env bash
# One-time: isolated Neeklo stack on neeklo.modelizmclub.ru (separate git checkout, DB, ports).
# Does NOT modify production modelizmclub.ru / api.modelizmclub.ru.
set -euo pipefail

PROD_DIR="/var/www/modelizmclub"
APP_DIR="/var/www/modelizmclub-neeklo"
REPO_SSH="git@github.com:letoceiling-coder/modelizmclub.git"
REPO_HTTPS="https://github.com/letoceiling-coder/modelizmclub.git"
GIT_BRANCH="${NEEKLO_GIT_BRANCH:-neeklo}"
CERT_EMAIL="${CERT_EMAIL:-admin@modelizmclub.ru}"

FRONT_DOMAIN="neeklo.modelizmclub.ru"
API_DOMAIN="neeklo-api.modelizmclub.ru"
WS_DOMAIN="neeklo-ws.modelizmclub.ru"

DB_NAME="modelizmclub_neeklo"
DB_USER="modelizmclub_neeklo"
SRC_DB="modelizmclub"

FRONTEND_PORT=3002
REVERB_PORT=8082

echo "==> PostgreSQL: isolated database ${DB_NAME}"
DB_PASS="${NEEKLO_DB_PASS:-$(openssl rand -hex 16)}"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "==> Cloning data from ${SRC_DB} (one-time copy, then independent)"
  sudo -u postgres pg_dump "${SRC_DB}" | sudo -u postgres psql "${DB_NAME}" >/dev/null
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};"
fi
mkdir -p /root
echo "NEEKLO_DB_NAME=${DB_NAME}" > /root/modelizmclub-neeklo-db.env
echo "NEEKLO_DB_USER=${DB_USER}" >> /root/modelizmclub-neeklo-db.env
echo "NEEKLO_DB_PASSWORD=${DB_PASS}" >> /root/modelizmclub-neeklo-db.env
chmod 600 /root/modelizmclub-neeklo-db.env

echo "==> Git clone (branch: ${GIT_BRANCH})"
mkdir -p /var/www
if [[ ! -d "${APP_DIR}/.git" ]]; then
  mkdir -p ~/.ssh
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null || true
  if ! git clone --branch "${GIT_BRANCH}" "${REPO_SSH}" "${APP_DIR}" 2>/dev/null; then
    echo "WARN: branch ${GIT_BRANCH} missing — cloning master, will checkout branch when available"
    git clone "${REPO_SSH}" "${APP_DIR}" 2>/dev/null || git clone "${REPO_HTTPS}" "${APP_DIR}"
    cd "${APP_DIR}"
    git fetch origin
    if git show-ref --verify --quiet "refs/remotes/origin/${GIT_BRANCH}"; then
      git checkout "${GIT_BRANCH}"
    else
      git checkout -b "${GIT_BRANCH}"
      echo "Created local branch ${GIT_BRANCH} from master — push to origin when ready"
    fi
  fi
fi

cd "${APP_DIR}"
git fetch origin
if git show-ref --verify --quiet "refs/remotes/origin/${GIT_BRANCH}"; then
  git checkout "${GIT_BRANCH}"
  git pull origin "${GIT_BRANCH}" || git pull origin master
else
  git checkout "${GIT_BRANCH}" 2>/dev/null || git checkout -b "${GIT_BRANCH}"
fi

echo "==> Backend .env (isolated from production)"
cd "${APP_DIR}/backend"
if [[ ! -f .env ]]; then
  cp "${PROD_DIR}/backend/.env" .env
fi

NEEKLO_KEY="$(openssl rand -hex 16)"
NEEKLO_SECRET="$(openssl rand -hex 32)"

sed -i "s|^APP_NAME=.*|APP_NAME=ModelizmClubNeeklo|" .env
sed -i "s|^APP_ENV=.*|APP_ENV=production|" .env
sed -i "s|^APP_URL=.*|APP_URL=https://${API_DOMAIN}|" .env
sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
sed -i "s|^REVERB_APP_ID=.*|REVERB_APP_ID=neeklo-modelizmclub|" .env
sed -i "s|^REVERB_APP_KEY=.*|REVERB_APP_KEY=${NEEKLO_KEY}|" .env
sed -i "s|^REVERB_APP_SECRET=.*|REVERB_APP_SECRET=${NEEKLO_SECRET}|" .env
sed -i "s|^REVERB_HOST=.*|REVERB_HOST=${WS_DOMAIN}|" .env
sed -i "s|^REVERB_PORT=.*|REVERB_PORT=443|" .env
sed -i "s|^REVERB_SCHEME=.*|REVERB_SCHEME=https|" .env
sed -i "s|^VITE_REVERB_APP_KEY=.*|VITE_REVERB_APP_KEY=${NEEKLO_KEY}|" .env
sed -i "s|^VITE_REVERB_HOST=.*|VITE_REVERB_HOST=${WS_DOMAIN}|" .env
sed -i "s|^VITE_REVERB_PORT=.*|VITE_REVERB_PORT=443|" .env
sed -i "s|^VITE_REVERB_SCHEME=.*|VITE_REVERB_SCHEME=https|" .env
sed -i "s|^SESSION_DOMAIN=.*|SESSION_DOMAIN=.modelizmclub.ru|" .env
sed -i "s|^VKONTAKTE_REDIRECT_URI=.*|VKONTAKTE_REDIRECT_URI=https://${API_DOMAIN}/api/v1/auth/oauth/vk/callback|" .env
sed -i "s|^YANDEX_REDIRECT_URI=.*|YANDEX_REDIRECT_URI=https://${API_DOMAIN}/api/v1/auth/oauth/yandex/callback|" .env

composer install --optimize-autoloader --no-interaction
php artisan key:generate --force
php artisan migrate --force
php artisan config:cache
php artisan route:cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

echo "==> systemd (neeklo-* services, ports ${FRONTEND_PORT}/${REVERB_PORT})"
cp "${APP_DIR}/deploy/systemd/neeklo-modelizmclub-frontend.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/systemd/neeklo-modelizmclub-reverb.service" /etc/systemd/system/
cp "${APP_DIR}/deploy/systemd/neeklo-modelizmclub-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable neeklo-modelizmclub-reverb.service neeklo-modelizmclub-worker.service neeklo-modelizmclub-frontend.service

echo "==> nginx HTTP vhosts (certbot)"
for dom in "${FRONT_DOMAIN}" "${API_DOMAIN}" "${WS_DOMAIN}"; do
  conf="${APP_DIR}/deploy/nginx/${dom}.http.conf"
  cp "${conf}" "/etc/nginx/sites-available/${dom}"
  ln -sf "/etc/nginx/sites-available/${dom}" "/etc/nginx/sites-enabled/${dom}"
done
nginx -t
systemctl reload nginx

echo "==> Let's Encrypt"
for dom in "${FRONT_DOMAIN}" "${API_DOMAIN}" "${WS_DOMAIN}"; do
  if ! certbot certificates 2>/dev/null | grep -q "Certificate Name: ${dom}"; then
    certbot --nginx -d "${dom}" --non-interactive --agree-tos -m "${CERT_EMAIL}" --redirect || true
  fi
done

for dom in "${FRONT_DOMAIN}" "${API_DOMAIN}" "${WS_DOMAIN}"; do
  if [[ -f "/etc/letsencrypt/live/${dom}/fullchain.pem" ]]; then
    cp "${APP_DIR}/deploy/nginx/${dom}.conf" "/etc/nginx/sites-available/${dom}"
  fi
done
nginx -t && systemctl reload nginx

echo "==> Frontend build"
export APP_DIR
export VITE_API_BASE_URL="https://${API_DOMAIN}/api/v1"
bash "${APP_DIR}/deploy/scripts/deploy-neeklo-frontend.sh"

systemctl restart neeklo-modelizmclub-reverb.service neeklo-modelizmclub-worker.service

echo ""
echo "==> Neeklo stack ready"
echo "  Frontend:  https://${FRONT_DOMAIN}/"
echo "  API:       https://${API_DOMAIN}/api/v1/health"
echo "  WebSocket: wss://${WS_DOMAIN}/"
echo "  App dir:   ${APP_DIR}"
echo "  Git branch: $(git -C ${APP_DIR} branch --show-current)"
echo "  DB creds:  /root/modelizmclub-neeklo-db.env"
echo ""
echo "Deploy updates: bash ${APP_DIR}/deploy/scripts/deploy-neeklo.sh"
