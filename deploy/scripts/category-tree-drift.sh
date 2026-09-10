#!/usr/bin/env bash
# Согласованность деревьев категорий: depth и path против parent_id.
#
# Дерево направлений трёхуровневое с 10.09 («Авиация → Планеры → ИЛ-6»), и
# три поля описывают одно и то же: `parent_id` — истина, `depth` и `path` —
# её пересказ. Расходятся они тихо: страница открывается, крошки врут,
# счётчики считают не тех. По `path` идёт отбор потомков (`path like 'a/b/%'`),
# поэтому неверный путь — это ещё и лента с чужими записями.
#
# 09.09 такое уже находили: у «ил 6» стоял `depth = 2` и путь через узел,
# которого в таблице нет вовсе. Дерево по `parent_id` показывало его корневым
# направлением, дерево по `path` — веткой, которой не существует.
#
# Проверка та же, что у `categories:normalize` после записи: второй
# реализации быть не должно, иначе они разойдутся.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${ROOT}/backend"

if [[ ! -f "${BACKEND_DIR}/artisan" ]]; then
  echo "category-tree: backend не найден по ${BACKEND_DIR}" >&2
  exit 2
fi

echo "category-tree: depth и path против parent_id"

if OUT="$(cd "${BACKEND_DIR}" && php artisan categories:normalize --check 2>&1)"; then
  echo "${OUT}" | sed 's/^/  /'
  exit 0
fi

echo "${OUT}" | sed 's/^/  /'
echo "  ВНИМАНИЕ: дерево категорий рассогласовано — см. строки выше" >&2
exit 1
