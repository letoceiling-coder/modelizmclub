#!/usr/bin/env bash
#
# Выложить конфиги nginx из репозитория на сервер.
#
# До 22.09 такого скрипта не было вовсе, и файлы в `deploy/nginx` были не
# источником правды, а его копией: правку вносили в репозиторий, а на сервер
# она не попадала никогда. `nginx-drift.sh` расхождение честно находил, но
# его вывод терялся — выкатка печатает из smoke только последнюю строку.
# Домены Яндекс.Метрики в политике безопасности пролежали так два дня.
#
# Скрипт намеренно НЕ вызывается из выкатки. Причина не в осторожности вообще,
# а в конкретном: в этих файлах живут пути к сертификатам, которые правит
# certbot. Молча перезаписывать их при каждой выкатке приложения — это
# однажды выложить конфиг со старым путём и погасить TLS. Применение —
# отдельное решение отдельной командой.
#
# По умолчанию показывает разницу и ничего не меняет.
#
#   bash deploy/scripts/nginx-apply.sh            # что изменится
#   bash deploy/scripts/nginx-apply.sh --apply    # применить и перезагрузить
#
set -uo pipefail

REPO="${REPO_DIR:-/var/www/modelizmclub}/deploy/nginx"
AVAILABLE=/etc/nginx/sites-available
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

if [[ ! -d "${REPO}" ]]; then
  echo "nginx-apply: нет каталога ${REPO}" >&2
  exit 1
fi

CHANGED=()
shopt -s nullglob
for f in "${REPO}"/*.conf; do
  base="$(basename "${f}" .conf)"
  live=""
  for cand in "${AVAILABLE}/${base}" "${AVAILABLE}/${base}.conf"; do
    [[ -f "${cand}" ]] && live="${cand}" && break
  done

  if [[ -z "${live}" ]]; then
    echo "  НОВЫЙ     ${base} — на сервере такого файла нет, выкладывать вручную"
    continue
  fi

  if diff -q "${live}" "${f}" >/dev/null 2>&1; then
    echo "  ok        ${base}"
    continue
  fi

  echo "  РАЗНИЦА   ${base}:"
  diff -u "${live}" "${f}" | sed 's/^/      /' | head -40
  CHANGED+=("${live}|${f}")
done

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "nginx-apply: расхождений нет"
  exit 0
fi

if [[ "${APPLY}" != "1" ]]; then
  echo "nginx-apply: файлов к применению ${#CHANGED[@]}; ничего не менял (нужен --apply)"
  exit 0
fi

# Копия перед заменой: откатывать руками в три часа ночи — плохой план.
STAMP="$(date +%Y%m%dT%H%M%S)"
BACKUP="/root/nginx-backup-${STAMP}"
mkdir -p "${BACKUP}"

for pair in "${CHANGED[@]}"; do
  live="${pair%%|*}"
  repo="${pair##*|}"
  cp -a "${live}" "${BACKUP}/$(basename "${live}")"
  cp -a "${repo}" "${live}"
  echo "  применён  $(basename "${live}")"
done

if ! nginx -t; then
  echo "nginx-apply: конфигурация не прошла проверку — возвращаю прежнюю" >&2
  for pair in "${CHANGED[@]}"; do
    live="${pair%%|*}"
    cp -a "${BACKUP}/$(basename "${live}")" "${live}"
  done
  nginx -t && systemctl reload nginx
  exit 1
fi

systemctl reload nginx
echo "nginx-apply: применено ${#CHANGED[@]}, копия прежних — ${BACKUP}"
