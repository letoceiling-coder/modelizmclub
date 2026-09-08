#!/usr/bin/env bash
#
# На чём держится модерация: на настройке или на одной строке в базе.
#
# У постов и объявлений автопубликация решается двумя источниками, и строка в
# `system_settings` перебивает окружение. 08.09 на проде выяснилось, что в
# боевом `.env` стоит `FEED_AUTO_PUBLISH=true`, а посты всё-таки уходят на
# модерацию — только потому, что рядом лежит `feature.feed_auto_publish` со
# значением `{"enabled": false}`. Удалить эту строку можно из админки, и
# лента начнёт публиковаться без проверки молча: ошибки не будет, статус
# просто перестанет быть `pending_moderation`.
#
# Проверка показывает оба слоя порознь. Совпадают — тихо. Расходятся —
# предупреждение с указанием, что именно снимет защиту.
#
# Отчёт, не приговор: автопубликация бывает нужна осознанно (стенд, разбор
# инцидента). Важно, чтобы про неё знали, а не обнаруживали по факту.
set -uo pipefail

ROOT="${1:-/var/www/modelizmclub}"
BACKEND="${ROOT}/backend"
FPM_USER="${FPM_USER:-www-data}"
STATUS=0

[[ -f "${BACKEND}/artisan" ]] || { echo "moderation-gates: ${BACKEND} не похож на приложение"; exit 0; }

read_gates() {
  sudo -u "${FPM_USER}" env XDG_CONFIG_HOME=/tmp HOME=/tmp \
    php "${BACKEND}/artisan" tinker --execute='
      $post = app(Modules\Feed\Services\PostService::class)->autoPublishEnabled();
      $lot  = app(Modules\Listing\Services\ListingService::class)->autoPublishEnabled();
      $env  = (bool) config("feed.auto_publish");
      echo "posts=".($post ? "on" : "off")."|lots=".($lot ? "on" : "off")."|env=".($env ? "on" : "off").PHP_EOL;
    ' 2>/dev/null | grep -oE 'posts=[a-z]+\|lots=[a-z]+\|env=[a-z]+' | head -1
}

GATES="$(cd "${BACKEND}" && read_gates)"

if [[ -z "${GATES}" ]]; then
  echo "moderation-gates: прочитать состояние не удалось — проверка не выполнялась"
  exit 0
fi

POSTS="${GATES#posts=}"; POSTS="${POSTS%%|*}"
LOTS="${GATES#*lots=}";  LOTS="${LOTS%%|*}"
ENVV="${GATES##*env=}"

echo "moderation-gates: посты — автопубликация ${POSTS}, объявления — ${LOTS}"

if [[ "${POSTS}" == "on" ]]; then
  echo "  WARN  посты публикуются без модерации"
  STATUS=1
fi

if [[ "${LOTS}" == "on" ]]; then
  echo "  WARN  объявления публикуются без модерации"
  STATUS=1
fi

# Главное: расхождение слоёв. Окружение говорит «публикуй сразу», а держит
# модерацию только строка в базе — которую можно удалить из админки.
if [[ "${ENVV}" == "on" && "${POSTS}" == "off" ]]; then
  echo "  WARN  FEED_AUTO_PUBLISH=true в .env, модерацию постов держит только"
  echo "        строка feature.feed_auto_publish в system_settings."
  echo "        Удалят строку — лента начнёт публиковаться без проверки."
  echo "        Починка: FEED_AUTO_PUBLISH=false в .env, затем config:cache,"
  echo "        chown root:${FPM_USER} и chmod 640 на bootstrap/cache/config.php."
  STATUS=1
fi

if [[ "${STATUS}" == "0" ]]; then
  echo "  ok    обе ступени на месте, окружение с базой не спорит"
fi

exit "${STATUS}"
