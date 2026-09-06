#!/usr/bin/env bash
# Прогон PHPUnit против modelizmclub_test (только PostgreSQL).
#
# ПРЕДУПРЕЖДЕНИЕ. Этот скрипт запускают и на боевом сервере, поэтому он не
# имеет права трогать ничего общего с php-fpm. Общий здесь ровно один файл —
# bootstrap/cache/config.php.
#
# Что бывает, если его сбросить. В процессах php-fpm нет переменных окружения:
# .env читается один раз при сборке кэша, дальше живёт только кэш. Убрали
# кэш — config/database.php разворачивается со своими умолчаниями, а там
# sqlite, и приложение начинает искать database/database.sqlite, которого нет.
# Каждый авторизованный запрос отвечает 500 до тех пор, пока кэш не соберут
# заново.
#
# Именно так и вышло 05.09: восемь ответов 500 на
# /api/v1/users/me/notifications/unread-count в 12:59, 13:32 и 17:20 — это три
# прогона тестов, а не дефект приложения. Тогда в скрипте стоял `config:clear`
# с восстановлением кэша по trap на выходе. Восстановление отработало, но
# дыра не в нём: между сбросом и концом прогона проходит около двух минут,
# и все эти две минуты сайт лежит для тех, кто вошёл.
#
# Поэтому здесь НЕ ДОЛЖНО появиться ни `config:clear`, ни `route:clear`, ни
# `config:cache`. Тестовому процессу нужен свой кэш, а не отсутствие общего:
# APP_CONFIG_CACHE и соседи задают путь к файлу кэша для конкретного процесса
# (Application::normalizeCachePath). Указываем их на пустой временный
# каталог — Laravel видит «кэша нет», читает .env.testing и подключается к
# modelizmclub_test. php-fpm тем временем продолжает читать свой файл, и он
# остаётся байт в байт прежним; скрипт это проверяет и ругается, если нет.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/modelizmclub}"

cd "${APP_DIR}/backend"

if [[ ! -f .env.testing ]]; then
  echo "Нет .env.testing — выполните: bash deploy/scripts/setup-test-db.sh" >&2
  exit 1
fi

SHARED_CACHE="bootstrap/cache/config.php"

# Отпечаток боевого кэша до прогона. Если файла нет — php-fpm уже в том самом
# сломанном состоянии, и молчать об этом нельзя: тесты пройдут, а сайт лежит.
if [[ -f "${SHARED_CACHE}" ]]; then
  BEFORE="$(md5sum "${SHARED_CACHE}" | awk '{print $1}')"
else
  BEFORE=""
  echo "ВНИМАНИЕ: ${SHARED_CACHE} отсутствует — авторизованные запросы сейчас" >&2
  echo "          отвечают 500. Соберите кэш: php artisan config:cache" >&2
fi

# Свой каталог кэша на процесс. mktemp, а не фиксированный путь: два
# одновременных прогона не должны читать кэш друг друга.
CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/modelizmclub-test-cache.XXXXXX")"
cleanup() { rm -rf "${CACHE_DIR}"; }
trap cleanup EXIT

# Файлов в CACHE_DIR нет, значит configurationIsCached() вернёт false и
# бутстрап прочитает .env.testing — ради этого всё и затевалось.
export APP_CONFIG_CACHE="${CACHE_DIR}/config.php"
export APP_ROUTES_CACHE="${CACHE_DIR}/routes-v7.php"
export APP_EVENTS_CACHE="${CACHE_DIR}/events.php"

echo "==> PHPUnit на PostgreSQL, база modelizmclub_test"
echo "    кэш процесса: ${CACHE_DIR} (боевой не трогаем)"

STATUS=0
php artisan test "$@" || STATUS=$?

if [[ -n "${BEFORE}" ]]; then
  AFTER="$(md5sum "${SHARED_CACHE}" | awk '{print $1}')"
  if [[ "${BEFORE}" != "${AFTER}" ]]; then
    echo "" >&2
    echo "ОШИБКА: боевой ${SHARED_CACHE} изменился за время прогона." >&2
    echo "        Значит что-то в цепочке всё-таки пересобрало общий кэш." >&2
    echo "        Проверьте сайт под учёткой и при необходимости выполните:" >&2
    echo "          php artisan config:cache" >&2
    exit 1
  fi
  echo "==> боевой кэш конфигурации не изменился (${BEFORE})"
fi

exit "${STATUS}"
