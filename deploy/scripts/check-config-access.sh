#!/usr/bin/env bash
#
# Может ли php-fpm прочитать .env — и не читает ли его весь сервер.
#
# 07.09 прод лежал шесть минут: `php artisan config:clear` от www-data снёс
# bootstrap/cache/config.php, после чего Laravel пошёл читать `.env`, не смог
# (файл был -rw------- root root) и увёл все `env()` в умолчания. DB_CONNECTION
# стал sqlite, весь API — 500. Приложение всё это время держалось не на
# настройках, а на кеше, собранном когда-то от root.
#
# Проверка нужна на каждом деплое, потому что беда молчаливая: пока кеш цел,
# ничего не видно.
#
# Заодно смотрим в обратную сторону. Если в кеше конфига лежит пароль базы, а
# файл доступен всем на чтение — секрет уже утёк, и права 600 у `.env` дают
# только иллюзию. 07.09 так и было: `.env` 600 root, а
# bootstrap/cache/config.php — 644 со всеми паролями внутри.
set -uo pipefail

ROOT="${1:-/var/www/modelizmclub}"
BACKEND="${ROOT}/backend"
ENV_FILE="${BACKEND}/.env"
CACHE_DIR="${BACKEND}/bootstrap/cache"

FPM_USER="${FPM_USER:-www-data}"
STATUS=0

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "config-access: ${ENV_FILE} не найден — проверять нечего"
  exit 0
fi

echo "config-access: ${ENV_FILE}"
echo "  права: $(stat -c '%a %U:%G' "${ENV_FILE}")"

if sudo -u "${FPM_USER}" test -r "${ENV_FILE}" 2>/dev/null; then
  echo "  ok    ${FPM_USER} читает .env — чистка кеша конфига не уронит сайт"
else
  echo "  FAIL  ${FPM_USER} НЕ читает .env"
  echo "        Сайт держится только на bootstrap/cache/config.php."
  echo "        Любая чистка кеша (в том числе случайная) кладёт API."
  echo "        Починка:"
  echo "          chown root:${FPM_USER} ${ENV_FILE} && chmod 640 ${ENV_FILE}"
  STATUS=1
fi

# Секреты лежат ровно в одном файле кеша — config.php: это запечённый .env.
# Остальные (routes, events, packages, services) секретов не несут, и трогать
# их права незачем.
CONFIG_CACHE="${CACHE_DIR}/config.php"
if [[ -f "${CONFIG_CACHE}" ]]; then
  mode="$(stat -c '%a' "${CONFIG_CACHE}")"
  echo "  кеш конфига: ${mode} $(stat -c '%U:%G' "${CONFIG_CACHE}")"
  if [[ "${mode: -1}" != "0" ]]; then
    echo "  WARN  config.php читают все, а внутри пароль базы открытым текстом"
    echo "        Починка: chmod 640 ${CONFIG_CACHE}"
    STATUS=1
  fi
fi

exit "${STATUS}"
