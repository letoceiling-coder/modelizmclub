#!/usr/bin/env bash
#
# На боевом сервере нет зависимостей разработки.
#
# Замерено 03.10: в `vendor/` прода лежали phpunit, faker, mockery, pint,
# collision, sail и `spatie/laravel-ignition`, поставленные 10 сентября.
# Выкатка `composer` не вызывала вовсе, значит убрать их было некому.
#
# Главное следствие — не размер каталога. Ignition регистрирует `/_ignition/*`,
# и `POST /_ignition/execute-solution` на боевом домене отвечал 500, а не 404:
# маршрут существовал и запрос до него доходил. Через этот адрес исторически
# исполняли код (CVE-2021-3129); нынешняя версия от того случая закрыта, но
# отладочной панели на боевом домене делать нечего, а `update-config` пишет
# настройки.
#
# Проверка смотрит каталог, а не `composer.json`: в нём эти пакеты и так в
# `require-dev` — расхождение именно между объявленным и установленным.
#
# Предупреждение, не приговор: на стенде набор разработки законен, а задача
# отличить стенд от прода у этой проверки нет. Важно, чтобы про него знали.
#
# Ответов три: 0 — чисто, 1 — набор разработки на месте, 2 — выяснить не
# удалось. Имена латиницей: кириллица в именах ломает bash молча.
set -uo pipefail

ROOT="${1:-/var/www/modelizmclub}"
VENDOR="${ROOT}/backend/vendor"

if [[ ! -d "${VENDOR}" ]]; then
  echo "no-dev-deps: ${VENDOR} не найден — выяснить не удалось" >&2
  exit 2
fi

# Список явный: он же служит описанием того, что считается набором разработки.
DEV_PACKAGES=(
  phpunit/phpunit
  spatie/laravel-ignition
  fakerphp/faker
  mockery/mockery
  laravel/pint
  nunomaduro/collision
  laravel/sail
  barryvdh/laravel-debugbar
  laravel/telescope
)

FOUND=()
for p in "${DEV_PACKAGES[@]}"; do
  [[ -d "${VENDOR}/${p}" ]] && FOUND+=("${p}")
done

if ((${#FOUND[@]} == 0)); then
  echo "no-dev-deps: ok — зависимостей разработки в ${VENDOR} нет"
  exit 0
fi

echo "no-dev-deps: в ${VENDOR} лежат зависимости разработки — ${#FOUND[@]} шт."
for p in "${FOUND[@]}"; do
  echo "  ${p}"
done
echo "                убрать: cd ${ROOT}/backend && composer install --no-dev --optimize-autoloader"
if [[ -d "${VENDOR}/spatie/laravel-ignition" ]]; then
  echo "                ignition открывает /_ignition/* — проверьте, что nginx его закрывает" >&2
fi
exit 1
