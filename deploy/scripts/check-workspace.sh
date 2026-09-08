#!/usr/bin/env bash
# Fails when stray files sit in the source trees.
#
# On 04.09 ten files were found in frontend/src/components that git had never
# heard of: pre-refactor PostCard.tsx, CommentSection.tsx, EmptyState.tsx and a
# few Finder duplicates. Nothing imported them, but tsc compiles everything
# under src/ and counted twenty errors against them — enough to move the number
# the merge gate is read from. Nobody could say where they came from.
#
# Three checks, because the junk arrives three different ways:
#
#   1. committed duplicates — «vitest.config 2.ts» is in git to this day, and
#      .gitignore cannot help with a file that is already tracked;
#   2. duplicates on disk — .gitignore hides them from `git status`, so after
#      adding those patterns the only way left to see them is to look;
#   3. untracked leftovers that are not duplicates — the two escrow classes
#      deleted from git in September but still on disk, autoloadable.
#
# A fresh CI checkout has no untracked files at all, so check 3 can only fire
# locally or after a build step writes somewhere it should not. That is the
# point: run this before committing, not only in CI.
set -uo pipefail

# Смотреть в настоящий индекс, а не в тот, что подсунут коммитом.
#
# `git commit -- <пути>` собирает временный индекс из HEAD и перечисленных
# путей и указывает на него `GIT_INDEX_FILE`. Хук наследует эту переменную, и
# `git status` внутри него не видит остального добавленного: файлы,
# отложенные до следующего коммита, выглядят неотслеживаемым мусором, и
# проверка останавливает коммит.
#
# Из-за этого работу нельзя было разложить по коммитам. 08.09 это стоило
# истории: страница записи `/post/{uuid}` ушла в чужой коммит про ключи ВТБ
# одним куском, и `git log --follow` по файлу теперь выводит не туда —
# разбирать пришлось отдельной записью в docs/known-issues.md.
#
# Проверка ищет посторонние файлы на диске, а не разбирает состав коммита,
# поэтому настоящий индекс здесь и нужен: снимаем переменную, дальше git сам
# возьмёт `$GIT_DIR/index`.
unset GIT_INDEX_FILE

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}" || exit 2

# Source trees only. deploy/, docs/ and the repository root hold operational
# files that legitimately come and go.
PATHS=(frontend/src backend/app)

# «file 2.ts», «file 3.tsx», «file копия.php» — a space, then a digit or the
# word. `v2.ts` and `page2.tsx` are ordinary names and must not match.
JUNK_RE=' [0-9]\.| копия|копия\.'

FAILED=0

TRACKED="$(git ls-files | grep -E "${JUNK_RE}" || true)"
if [[ -n "${TRACKED}" ]]; then
  echo "В репозитории лежат файлы-дубли — их не спасёт .gitignore, нужен git rm:" >&2
  while IFS= read -r f; do printf '  %s\n' "${f}" >&2; done <<< "${TRACKED}"
  FAILED=1
fi

ON_DISK="$(find "${PATHS[@]}" -type f \( -name '* [0-9].*' -o -name '*копия*' \) 2>/dev/null || true)"
if [[ -n "${ON_DISK}" ]]; then
  echo "Дубли на диске в исходниках — их компилирует tsc, но не показывает git status:" >&2
  while IFS= read -r f; do printf '  %s\n' "${f}" >&2; done <<< "${ON_DISK}"
  FAILED=1
fi

UNTRACKED="$(git status --porcelain --untracked-files=all -- "${PATHS[@]}" | grep '^??' | cut -c4- || true)"
if [[ -n "${UNTRACKED}" ]]; then
  echo "Неотслеживаемые файлы в исходниках — либо в коммит, либо в корзину:" >&2
  while IFS= read -r f; do printf '  %s\n' "${f}" >&2; done <<< "${UNTRACKED}"
  FAILED=1
fi

if [[ "${FAILED}" != "0" ]]; then
  echo "" >&2
  echo "check-workspace: исходники не чисты" >&2
  exit 1
fi

echo "check-workspace: ${PATHS[*]} — посторонних файлов нет"
