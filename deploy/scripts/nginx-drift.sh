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
ENABLED=/etc/nginx/sites-enabled
STATUS=0

echo "nginx-drift: ${REPO} против ${AVAILABLE}"

shopt -s nullglob
for f in "${REPO}"/*.conf; do
  base="$(basename "${f}" .conf)"
  live=""
  for cand in "${AVAILABLE}/${base}" "${AVAILABLE}/${base}.conf"; do
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

if [[ "${STATUS}" == "0" ]]; then
  echo "  ok    боевой nginx совпадает с репозиторием, в sites-enabled только симлинки"
fi

exit "${STATUS}"
