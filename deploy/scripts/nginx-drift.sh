#!/usr/bin/env bash
#
# Расходится ли боевой nginx с репозиторием.
#
# Болезнь повторяющаяся: правку вносят в файл на сервере, репозиторий про неё
# не знает, и наоборот. 07.09 `sites-enabled/api.modelizmclub.ru.conf` был
# обычным файлом, а не симлинком на `sites-available` — правки в
# `sites-available` не влияли ни на что, и я час сравнивал репозиторий с
# копией, которую nginx не читает. 08.09 нашлось ещё три расхождения:
# `dev` с `client_max_body_size 100M` вместо 1024M (то есть вторая дверь в то
# же приложение молча резала загрузку), `turn` с потерянными пустыми строками
# и осиротевшая копия `modelizmclub.ru` в `sites-available`, на которую никто
# не смотрел.
#
# Скрипт сверяет три вещи:
#   1. каждый *.conf из deploy/nginx совпадает с тем, что лежит в
#      sites-available;
#   2. в sites-enabled только симлинки — обычный файл там означает, что
#      источник правды раздвоился;
#   3. симлинк ведёт в sites-available, а не куда-то ещё.
#
# Отчёт, не приговор: конфиги правят руками осознанно (сертификаты, временные
# заглушки). Важно, чтобы разница была видна, а не жила годами.
set -uo pipefail

REPO="${1:-/var/www/modelizmclub}/deploy/nginx"
AVAILABLE=/etc/nginx/sites-available
CONFD=/etc/nginx/conf.d
ENABLED=/etc/nginx/sites-enabled
STATUS=0

echo "nginx-drift: ${REPO} против ${AVAILABLE}"

shopt -s nullglob
for f in "${REPO}"/*.conf; do
  base="$(basename "${f}" .conf)"
  live=""
  # conf.d — тоже законное место: там живут конфиги без домена, например
  # fpm-status на 127.0.0.1. Ищем и там, иначе скрипт вечно ругался бы на них.
  for cand in "${AVAILABLE}/${base}" "${AVAILABLE}/${base}.conf" "${CONFD}/${base}.conf"; do
    [[ -f "${cand}" ]] && live="${cand}" && break
  done

  if [[ -z "${live}" ]]; then
    # Часть файлов репозитория — заготовки для http-этапа выпуска сертификата,
    # на сервере их быть не должно. Молчим про них.
    [[ "${base}" == *.http ]] && continue
    printf '  нет на сервере  %s\n' "${base}"
    continue
  fi

  if ! diff -q "${f}" "${live}" >/dev/null 2>&1; then
    printf '  РАСХОДИТСЯ      %s (%s строк)\n' "${base}" "$(diff "${f}" "${live}" | grep -c '^[<>]')"
    STATUS=1
  fi
done
shopt -u nullglob

for f in "${ENABLED}"/*; do
  [[ -e "${f}" ]] || continue
  if [[ ! -L "${f}" ]]; then
    printf '  НЕ СИМЛИНК      %s — источник правды раздвоился\n' "$(basename "${f}")"
    STATUS=1
  elif [[ "$(readlink "${f}")" != "${AVAILABLE}/"* ]]; then
    printf '  ЧУЖАЯ ЦЕЛЬ      %s -> %s\n' "$(basename "${f}")" "$(readlink "${f}")"
    STATUS=1
  fi
done

# Отвечает ли сервер на чужое имя хоста.
#
# До 20.09 `default_server` не стоял ни в одном блоке, и запрос с любым
# доменом, направленным на этот адрес, доставался первому по порядку загрузки
# — `api.modelizmclub.ru`. Сайт открывался под чужим именем, отвечая 200 на
# `/`. Уловитель лежит в `conf.d/default-server.conf` и закрывает соединение.
#
# Проверка стоит здесь, а не в `smoke-check.sh`: там отказ откатывает релиз
# фронтенда (см. `deploy-frontend.sh`), а свойство конфига nginx к сборке
# фронта отношения не имеет. Здесь — отчёт, как и всё остальное в этом файле.
#
# Спрашиваем один и тот же порт двумя именами. Само по себе «чужое имя
# молчит» означало бы и «порт 80 не слушают вовсе», то есть сломанные
# редиректы http→https на всех тринадцати доменах сразу; пара различает.
code_of() {
  local out
  out="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null)"
  printf '%s' "${out:-000}"
}

KNOWN="$(code_of -H 'Host: modelizmclub.ru' http://127.0.0.1/)"
UNKNOWN="$(code_of -H 'Host: unknown.invalid' http://127.0.0.1/)"

if [[ "${KNOWN}" == "000" ]]; then
  printf '  не проверено    порт 80 молчит и своему имени — про чужое сказать нечего\n'
elif [[ "${UNKNOWN}" != "000" ]]; then
  printf '  ОТВЕЧАЕТ ЧУЖИМ  неизвестное имя хоста получает %s, а должно — закрытое соединение\n' "${UNKNOWN}"
  STATUS=1
else
  printf '  ok    чужое имя хоста закрыто (своё отвечает %s)\n' "${KNOWN}"
fi

if [[ "${STATUS}" == "0" ]]; then
  echo "  ok    боевой nginx совпадает с репозиторием, в sites-enabled только симлинки"
fi

exit "${STATUS}"
