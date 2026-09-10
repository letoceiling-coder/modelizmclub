#!/usr/bin/env bash
#
# Рабочее дерево на задачу — одной командой.
#
# Правило «каждая задача в своём дереве» существовало и раньше, но выполнялось
# вручную: `git worktree add`, потом `bun install`, потом `composer install`,
# потом не забыть убрать за собой и удалить ветку. Четыре шага, каждый можно
# пропустить, — и 08.09 три раза подряд оказалось проще не заводить дерево
# вовсе. Итог: `git add -A` дважды смёл чужую незакоммиченную работу, а третий
# раз соседняя сессия увела ветку из-под работающей.
#
# Поэтому команда одна и делает всё:
#
#   worktree.sh new fix/payment-quality      завести дерево и поставить зависимости
#   worktree.sh new docs/foo --no-deps       без зависимостей (правка только текстов)
#   worktree.sh list                         кто ещё работает и что у него не закоммичено
#   worktree.sh done fix/payment-quality     убрать дерево и ветку
#
# Имя каталога берётся из последнего сегмента ветки: `fix/payment-quality` даёт
# `../MODELISM-payment-quality`. База — `origin/master`, а не текущий HEAD:
# ветвиться от чужой недоделанной работы незачем.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAIN="$(git -C "${ROOT}" worktree list --porcelain | head -1 | cut -d' ' -f2-)"
PARENT="$(dirname "${MAIN}")"
PREFIX="$(basename "${MAIN}")"

usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# Без сброса окружения git в чужом дереве читает файлы одни, а индекс другой:
# во время коммита выставлены GIT_DIR, GIT_INDEX_FILE и GIT_WORK_TREE, и
# `git -C <чужое> status` их наследует. Первая версия проверки в хуке из-за
# этого сообщала «225 незакоммиченных файлов» о пустом дереве.
wt_status() {
  env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE \
      -u GIT_OBJECT_DIRECTORY -u GIT_COMMON_DIR -u GIT_PREFIX \
      git -C "$1" status --porcelain 2>/dev/null
}

cmd_new() {
  local branch="${1:-}"
  [[ -n "${branch}" ]] || { echo "нужна ветка: worktree.sh new fix/<задача>" >&2; exit 2; }
  shift || true

  local deps=1
  for arg in "$@"; do
    [[ "${arg}" == "--no-deps" ]] && deps=0
  done

  local dir="${PARENT}/${PREFIX}-$(basename "${branch}")"

  if [[ -e "${dir}" ]]; then
    echo "каталог уже есть: ${dir}" >&2
    echo "если он от прошлой задачи — worktree.sh done <ветка>" >&2
    exit 1
  fi

  git -C "${ROOT}" fetch origin --quiet
  git -C "${ROOT}" worktree add "${dir}" -b "${branch}" origin/master

  if [[ "${deps}" == "1" ]]; then
    echo "зависимости фронтенда…"
    (cd "${dir}/frontend" && bun install --frozen-lockfile >/dev/null)
    echo "зависимости бэкенда…"
    (cd "${dir}/backend" && composer install --no-interaction --no-progress --quiet)
    # Тесты и artisan читают backend/.env; без него всё работает, но сыплет
    # предупреждениями «.env: Failed to open stream» на каждый прогон.
    if [[ ! -f "${dir}/backend/.env" && -f "${dir}/backend/.env.testing.example" ]]; then
      cp "${dir}/backend/.env.testing.example" "${dir}/backend/.env"
      (cd "${dir}/backend" && php artisan key:generate --force >/dev/null 2>&1) || true
    fi
  fi

  # Имя тестовой базы для этого дерева. Одна база на все деревья означала,
  # что два прогона роняют друг другу схему; проверка в tests/TestCase.php
  # теперь смотрит на префикс, и своё имя достаточно назвать.
  local db="modelizmclub_test_$(echo "${dir##*/}" | tr '[:upper:]-' '[:lower:]_' | tr -cd 'a-z0-9_')"

  echo
  echo "готово: ${dir}   ветка ${branch}   база origin/master"
  echo "  cd ${dir}"
  echo
  echo "своя тестовая база (иначе прогоны двух деревьев столкнутся):"
  echo "  DB_NAME=${db} bash deploy/scripts/setup-test-db.sh"
  echo "  DB_DATABASE=${db} php artisan test"
}

cmd_list() {
  local main_root="${MAIN}"
  git -C "${ROOT}" worktree list --porcelain | awk '
    /^worktree /  { wt = substr($0, 10) }
    /^branch /    { print wt "\t" substr($0, 8) }
    /^detached$/  { print wt "\tdetached" }
  ' | while IFS=$'\t' read -r wt br; do
    local mark="" dirty
    [[ "${wt}" == "${main_root}" ]] && mark="  (общее дерево)"
    if [[ -d "${wt}" ]]; then
      dirty="$(wt_status "${wt}" | wc -l | tr -d ' ')"
      [[ "${dirty}" == "0" ]] && dirty="чисто" || dirty="незакоммичено: ${dirty}"
    else
      dirty="каталога нет"
    fi
    printf '%-62s %-34s %s%s\n' "${wt}" "${br#refs/heads/}" "${dirty}" "${mark}"
  done
}

cmd_done() {
  local branch="${1:-}"
  [[ -n "${branch}" ]] || { echo "нужна ветка: worktree.sh done fix/<задача>" >&2; exit 2; }
  local dir="${PARENT}/${PREFIX}-$(basename "${branch}")"

  if [[ -d "${dir}" ]] && [[ -n "$(wt_status "${dir}")" ]]; then
    echo "в ${dir} есть незакоммиченное:" >&2
    wt_status "${dir}" | sed 's/^/  /' >&2
    echo "разберитесь с ним или удаляйте руками: git worktree remove --force ${dir}" >&2
    exit 1
  fi

  git -C "${ROOT}" worktree remove "${dir}" 2>/dev/null || true
  git -C "${ROOT}" worktree prune
  # Ветка не исчезает вместе с деревом. Удаляем только слитую: -d, не -D.
  git -C "${ROOT}" branch -d "${branch}" 2>/dev/null \
    || echo "ветка ${branch} не слита — оставлена; удалить: git branch -D ${branch}"

  echo "убрано: ${dir}"
}

case "${1:-}" in
  new)  shift; cmd_new "$@" ;;
  list) cmd_list ;;
  done) shift; cmd_done "$@" ;;
  -h|--help|"") usage 0 ;;
  *) echo "неизвестная команда: ${1}" >&2; usage 2 ;;
esac
