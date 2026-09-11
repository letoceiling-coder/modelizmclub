#!/usr/bin/env bash
#
# Есть ли у очереди медиа чем кодировать AVIF.
#
# Код для AVIF был написан 04.09 и не работал ни дня: libgd3 в Ubuntu собран
# без libavif, `imageavif` в PHP нет, а в боевом `.env` стоял
# `MEDIA_VARIANTS_AVIF=false` — выключатель «для хостов без кодировщика».
# Формат пропускался молча, и снаружи это выглядело как «AVIF есть, просто не
# нужен». 11.09 поставлен libavif-bin, флаг включён, 264 медиа догнаны
# командой `media:add-avif`.
#
# Сломать это снова легко и незаметно: новый сервер из server-setup.sh без
# пакета, `apt autoremove`, откат `.env` из старой копии — и новые загрузки
# опять пойдут без AVIF, не выдав ни одной ошибки. Проверка показывает, что
# приложение видит сейчас, глазами того же пользователя, от которого работает
# воркер.
#
# Отчёт, не приговор: без AVIF сайт работает, просто тяжелее.
set -uo pipefail

ROOT="${1:-/var/www/modelizmclub}"
BACKEND="${ROOT}/backend"
FPM_USER="${FPM_USER:-www-data}"

[[ -f "${BACKEND}/artisan" ]] || { echo "avif-encoder: ${BACKEND} не похож на приложение"; exit 0; }

STATE="$(cd "${BACKEND}" && sudo -u "${FPM_USER}" env XDG_CONFIG_HOME=/tmp HOME=/tmp \
  php artisan tinker --execute='
    $p = app(Modules\Media\Services\MediaVariantProcessor::class);
    // Те же критерии, что у media:add-avif: только то, что команда
    // способна догнать. Первая версия считала все медиа без AVIF и на проде
    // показала 18 при «догонять нечего» — это были не картинки для очереди.
    $sizes = array_keys(config("media.variants.sizes", []));
    $missing = 0;
    App\Models\Media::query()
      ->where("status", App\Enums\MediaStatus::Ready)
      ->whereNotNull("variants")
      ->orderBy("id")
      ->chunkById(200, function ($rows) use ($p, $sizes, &$missing) {
        foreach ($rows as $m) {
          $v = $m->variants;
          if (! is_array($v) || $v === [] || ! $p->shouldProcess($m)) continue;
          foreach ($sizes as $n) {
            if (is_array($v[$n] ?? null) && empty($v[$n]["avif"]["path"])) { $missing++; break; }
          }
        }
      });
    echo "enabled=".(config("media.variants.avif.enabled") ? "on" : "off")
       ."|encoder=".($p->avifEncoder() ?? "none")
       ."|missing=".$missing.PHP_EOL;
  ' 2>/dev/null | grep -oE 'enabled=[a-z]+\|encoder=[a-z]+\|missing=[0-9]+' | head -1)"

if [[ -z "${STATE}" ]]; then
  echo "avif-encoder: прочитать состояние не удалось — проверка не выполнялась"
  exit 0
fi

ENABLED="${STATE#enabled=}"; ENABLED="${ENABLED%%|*}"
ENCODER="${STATE#*encoder=}"; ENCODER="${ENCODER%%|*}"
MISSING="${STATE##*missing=}"

echo "avif-encoder: флаг ${ENABLED}, кодировщик ${ENCODER}, догнать можно — ${MISSING}"

if [[ "${ENABLED}" != "on" ]]; then
  echo "  WARN  MEDIA_VARIANTS_AVIF выключен — новые загрузки идут без AVIF"
  exit 1
fi

if [[ "${ENCODER}" == "none" ]]; then
  echo "  WARN  флаг включён, но кодировать нечем: нет ни imageavif, ни avifenc."
  echo "        Починка: apt-get install --no-install-recommends libavif-bin"
  exit 1
fi

if [[ "${MISSING}" != "0" ]]; then
  echo "  WARN  ${MISSING} медиа можно догнать: nice -n 19 php artisan media:add-avif --sleep=2"
  exit 1
fi

echo "  ok    AVIF кодируется (${ENCODER}), догонять нечего"
exit 0
