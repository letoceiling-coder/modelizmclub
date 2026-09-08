#!/usr/bin/env bash
#
# Ставит pre-commit и post-checkout, охраняющие общее рабочее дерево.
#
# За 08.09 финдеровские дубли появлялись в `frontend/src` трижды:
# «deals.index 2.tsx», «tap-target 2.ts», «routeAccessTier.test 2.ts» и
# «ask 2.tsx». Их не показывает `git status` — они не отслеживаются, — но их
# компилирует tsc и линтует eslint. Из-за одного такого дубля порог eslint
# полдня стоял красным (1533 против 1518), и заметил я это случайно.
#
# В тот же день дважды сработала другая беда: две сессии в одном рабочем
# дереве. `git add -A` в докоммите смёл чужую незаконченную работу — сначала
# воскресший DeliveryChoiceSheet, потом восемь файлов страницы /post/{uuid}.
# Пострадали обе стороны: одна унесла в свой коммит то, чего не писала,
# вторая потеряла авторство и полдня не знала, что её работа уже в master
# под чужим сообщением.
#
# Хуки не хранятся в репозитории и не приезжают с `git clone`, поэтому команда
# ставится руками — один раз на машину:
#
#   bash deploy/scripts/install-git-hooks.sh
#
# Что ставится и что каждый хук может, разобрано в CLAUDE.md, раздел
# «Параллельные сессии». Коротко: часть правил хук закрывает запретом, часть —
# только показывает, потому что у git нет нужной точки входа.
#
# Обойти проверку, когда она мешает осознанно: `git commit --no-verify`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GIT_DIR="$(git -C "${ROOT}" rev-parse --git-common-dir 2>/dev/null || true)"

if [[ -z "${GIT_DIR}" ]]; then
  echo "не репозиторий: ${ROOT}" >&2
  exit 1
fi

# --git-common-dir отдаёт относительный путь, если запуск из основного дерева.
case "${GIT_DIR}" in
  /*) ;;
  *) GIT_DIR="${ROOT}/${GIT_DIR}" ;;
esac

HOOKS="${GIT_DIR}/hooks"
mkdir -p "${HOOKS}"

# ---------------------------------------------------------------- pre-commit

cat > "${HOOKS}/pre-commit" <<'HOOK_BODY'
#!/usr/bin/env bash
# Поставлен deploy/scripts/install-git-hooks.sh. Обойти: git commit --no-verify
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CHECK="${ROOT}/deploy/scripts/check-workspace.sh"

# git в чужом дереве — только с чистым окружением.
#
# Во время коммита git выставляет GIT_DIR, GIT_INDEX_FILE и GIT_WORK_TREE под
# текущее дерево, и `git -C <чужое> status` наследует их: файлы читаются одни,
# индекс другой. Первая версия проверки из-за этого сообщала «225
# незакоммиченных файлов» о дереве, где не было ни одного.
wt_status() {
  env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE \
      -u GIT_OBJECT_DIRECTORY -u GIT_COMMON_DIR -u GIT_PREFIX \
      git -C "$1" status --porcelain 2>/dev/null
}

# 1. Посторонние файлы в исходниках: финдеровские дубли и неотслеживаемое.
if [[ -x "${CHECK}" ]] && ! "${CHECK}"; then
  echo "" >&2
  echo "pre-commit: коммит остановлен — сначала уберите посторонние файлы." >&2
  echo "            осознанно обойти: git commit --no-verify" >&2
  exit 1
fi

# 2. Соседние деревья: кто ещё работает и не занят ли кто-то прямо сейчас.
#
# Правило «каждая задача в своём worktree» хук соблюсти не может — он не знает,
# сколько людей сидит за деревом. Зато может показать соседей: если рядом
# живёт непустое дерево, коммит из общего — та самая ситуация 08.09.
WT_LINES="$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | cut -d' ' -f2-)"
WT_COUNT="$(printf '%s\n' "${WT_LINES}" | grep -c . || true)"
if [[ "${WT_COUNT}" -gt 1 ]]; then
  echo "pre-commit: рабочих деревьев: ${WT_COUNT} — параллельная работа идёт."
  while IFS= read -r wt; do
    [[ -z "${wt}" ]] && continue
    [[ "${wt}" == "${ROOT}" ]] && continue
    [[ -d "${wt}" ]] || { echo "            ${wt} — каталога нет"; continue; }
    WT_DIRTY="$(wt_status "${wt}")"
    if [[ -n "${WT_DIRTY}" ]]; then
      echo "            ${wt} — незакоммиченных файлов: $(printf '%s\n' "${WT_DIRTY}" | wc -l | tr -d ' ')"
    else
      echo "            ${wt} — чисто"
    fi
  done <<< "${WT_LINES}"
fi

# 3. Что именно уходит в коммит — всегда на глаза автору.
STAGED="$(git diff --cached --name-only)"
[[ -z "${STAGED}" ]] && exit 0

COUNT="$(printf '%s\n' "${STAGED}" | wc -l | tr -d ' ')"
echo "pre-commit: в коммит уходит файлов: ${COUNT}"
printf '%s\n' "${STAGED}" | sed 's/^/  /' | head -20
[[ "${COUNT}" -gt 20 ]] && echo "  … и ещё $((COUNT - 20))"

# 4. Что осталось рядом и в коммит не идёт.
#
# Ровно то, ради чего правило велит смотреть `git status` перед коммитом:
# изменения, которых вы не делали, видно здесь. Печатается, а не запрещается:
# коммитить часть своей работы — обычное дело, и запрет приучил бы к
# --no-verify, после чего перестали бы работать проверки выше.
REST="$(git status --porcelain | grep -v '^[MARCD] ' || true)"
if [[ -n "${REST}" ]]; then
  REST_COUNT="$(printf '%s\n' "${REST}" | wc -l | tr -d ' ')"
  echo "pre-commit: рядом осталось (в коммит не идёт), файлов: ${REST_COUNT}"
  printf '%s\n' "${REST}" | sed 's/^/  /' | head -20
  [[ "${REST_COUNT}" -gt 20 ]] && echo "  … и ещё $((REST_COUNT - 20))"
  echo "            если что-то из этого писали не вы — остановитесь и спросите."
fi

# 5. Документация не должна тащить за собой код.
#
# Дважды за 08.09 `git add -A` в общем рабочем дереве смёл в докоммит чужую
# незаконченную работу: сначала воскресший DeliveryChoiceSheet, потом восемь
# файлов страницы /post/{uuid} из параллельной сессии. Оба раза коммит
# назывался docs(...) и оба раза уехал в master. Проверка узкая нарочно:
# смешивать бэкенд с фронтендом — обычное дело, а вот документация вместе с
# кодом почти всегда означает, что подмели лишнее.
HAS_DOCS=0
HAS_CODE=0
while IFS= read -r f; do
  case "${f}" in
    *.md|docs/*|deploy/docs/*)              HAS_DOCS=1 ;;
    frontend/src/*|backend/app/*|backend/routes/*|backend/config/*|backend/database/*|backend/tests/*)
                                            HAS_CODE=1 ;;
  esac
done <<< "${STAGED}"

if [[ "${HAS_DOCS}" == "1" && "${HAS_CODE}" == "1" ]]; then
  echo "" >&2
  echo "pre-commit: в одном коммите документация и код." >&2
  echo "            Так дважды уезжала чужая незакоммиченная работа." >&2
  echo "            Разделите коммиты или, если смешение осознанное:" >&2
  echo "              git commit --no-verify" >&2
  exit 1
fi

exit 0
HOOK_BODY

chmod +x "${HOOKS}/pre-commit"

# ------------------------------------------------------------- post-checkout

cat > "${HOOKS}/post-checkout" <<'HOOK_BODY'
#!/usr/bin/env bash
# Поставлен deploy/scripts/install-git-hooks.sh.
#
# Переключение ветки в общем дереве при живой параллельной сессии забирает
# чужие несохранённые правки: git молча переносит их на новую ветку, и
# следующий `git add` уже в другой истории. Запретить это хук не может —
# точки входа «до checkout» у git нет, post-checkout срабатывает после. Значит,
# задача — сказать вслух сразу, пока правки не уехали дальше в коммит.
set -uo pipefail

PREV="${1:-}"
NEXT="${2:-}"
IS_BRANCH="${3:-0}"

# $3 == 0 — это checkout отдельных файлов, ветка не менялась.
[[ "${IS_BRANCH}" == "1" ]] || exit 0

# Равенство PREV и NEXT не повод молчать: `git checkout -b` от текущего
# коммита их не меняет, а несохранённые правки на новую ветку уносит — это и
# есть случай 08.09. Первая версия хука на этом сравнении выходила и не
# сказала ни слова.
: "${PREV}" "${NEXT}"

ROOT="$(git rev-parse --show-toplevel)"
CARRIED="$(git status --porcelain | grep -v '^??' || true)"

# См. пояснение про окружение в pre-commit: без сброса переменных git читает
# чужое дерево своим индексом и врёт.
wt_status() {
  env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE \
      -u GIT_OBJECT_DIRECTORY -u GIT_COMMON_DIR -u GIT_PREFIX \
      git -C "$1" status --porcelain 2>/dev/null
}

if [[ -n "${CARRIED}" ]]; then
  COUNT="$(printf '%s\n' "${CARRIED}" | wc -l | tr -d ' ')"
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo ""
  echo "post-checkout: на ветку ${BRANCH} перенесено несохранённых файлов: ${COUNT}"
  printf '%s\n' "${CARRIED}" | sed 's/^/  /' | head -20
  [[ "${COUNT}" -gt 20 ]] && echo "  … и ещё $((COUNT - 20))"
  echo "               Если это писали не вы — вернитесь: git checkout -"
  echo "               и заведите своё дерево: git worktree add ../MODELISM-<задача>"
fi

WT_LINES="$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | cut -d' ' -f2-)"
while IFS= read -r wt; do
  [[ -z "${wt}" ]] && continue
  [[ "${wt}" == "${ROOT}" ]] && continue
  [[ -d "${wt}" ]] || continue
  if [[ -n "$(wt_status "${wt}")" ]]; then
    echo "post-checkout: рядом работает ${wt} — там есть незакоммиченные правки."
  fi
done <<< "${WT_LINES}"

exit 0
HOOK_BODY

chmod +x "${HOOKS}/post-checkout"

echo "pre-commit установлен:    ${HOOKS}/pre-commit"
echo "post-checkout установлен: ${HOOKS}/post-checkout"
echo "проверка на текущем состоянии:"
bash "${ROOT}/deploy/scripts/check-workspace.sh"
