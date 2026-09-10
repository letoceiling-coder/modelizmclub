#!/usr/bin/env bash
# Каждый вызов `config:cache` возвращает кешу права 640.
#
# Кеш конфигурации — это запечённый `.env`: пароль базы лежит внутри открытым
# текстом. `config:cache` создаёт файл с умолчательными 644, то есть открывает
# его любому пользователю сервера, и права приходится возвращать руками.
#
# 08.09 в CLAUDE.md записали, что `chmod 640` стоит «во всех скриптах, которые
# её вызывают». 10.09 пересчёт показал другое: вызовов четырнадцать, `chmod`
# рядом стоял в четырёх. Десять скриптов молча отменяли починку прав — и
# заметить это можно было только пересчётом, потому что ничто не проверяло.
#
# Отсюда эта проверка. Она смотрит не на сервер, а на репозиторий: рядом с
# каждым вызовом должен стоять chmod. Одиннадцатый скрипт без него не пройдёт.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS="${ROOT}/deploy/scripts"

# Сколько строк после вызова считаем «рядом». Шести хватает на комментарий из
# пяти строк и саму команду — так это и написано в исправленных скриптах.
WINDOW="${CONFIG_CACHE_CHMOD_WINDOW:-8}"

missing=()
total=0

while IFS=: read -r file line _; do
  [[ -n "${file}" ]] || continue
  total=$((total + 1))
  if ! sed -n "$((line + 1)),$((line + WINDOW))p" "${file}" | grep -q 'chmod 640'; then
    missing+=("${file#"${ROOT}/"}:${line}")
  fi
done < <(grep -rn '^[[:space:]]*php artisan config:cache' "${SCRIPTS}" 2>/dev/null)

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "config-cache-chmod: вызовов ${total}, без chmod 640 рядом: ${#missing[@]}" >&2
  for m in "${missing[@]}"; do
    echo "  ${m}" >&2
  done
  echo "" >&2
  echo "  Добавьте сразу после вызова:" >&2
  echo "    chmod 640 bootstrap/cache/config.php 2>/dev/null || true" >&2
  echo "  Иначе запуск скрипта оставит пароль базы читаемым всем на сервере." >&2
  exit 1
fi

# Пустой список — не повод радоваться: так же выглядит сломанный поиск.
if [[ ${total} -eq 0 ]]; then
  echo "config-cache-chmod: не найдено ни одного вызова — проверка не сработала" >&2
  exit 2
fi

echo "config-cache-chmod: ok — все ${total} вызовов возвращают права 640"
