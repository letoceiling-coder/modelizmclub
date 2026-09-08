#!/usr/bin/env bash
#
# Ставит pre-commit, который не пускает в коммит посторонние файлы в исходниках.
#
# За 08.09 финдеровские дубли появлялись в `frontend/src` трижды:
# «deals.index 2.tsx», «tap-target 2.ts», «routeAccessTier.test 2.ts» и
# «ask 2.tsx». Их не показывает `git status` — они не отслеживаются, — но их
# компилирует tsc и линтует eslint. Из-за одного такого дубля порог eslint
# полдня стоял красным (1533 против 1518), и заметил я это случайно.
#
# Хуки не хранятся в репозитории и не приезжают с `git clone`, поэтому команда
# ставится руками — один раз на машину:
#
#   bash deploy/scripts/install-git-hooks.sh
#
# Хук делает три вещи: гонит check-workspace, показывает список уходящих в
# коммит файлов и не пускает коммит, где документация смешана с кодом.
#
# Обойти проверку, когда она мешает осознанно: `git commit --no-verify`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="${ROOT}/.git/hooks/pre-commit"

if [[ ! -d "${ROOT}/.git" ]]; then
  echo "не репозиторий: ${ROOT}" >&2
  exit 1
fi

cat > "${HOOK}" <<'HOOK_BODY'
#!/usr/bin/env bash
# Поставлен deploy/scripts/install-git-hooks.sh. Обойти: git commit --no-verify
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CHECK="${ROOT}/deploy/scripts/check-workspace.sh"

# 1. Посторонние файлы в исходниках: финдеровские дубли и неотслеживаемое.
if [[ -x "${CHECK}" ]] && ! "${CHECK}"; then
  echo "" >&2
  echo "pre-commit: коммит остановлен — сначала уберите посторонние файлы." >&2
  echo "            осознанно обойти: git commit --no-verify" >&2
  exit 1
fi

# 2. Что именно уходит в коммит — всегда на глаза автору.
STAGED="$(git diff --cached --name-only)"
[[ -z "${STAGED}" ]] && exit 0

COUNT="$(printf '%s\n' "${STAGED}" | wc -l | tr -d ' ')"
echo "pre-commit: в коммит уходит файлов: ${COUNT}"
printf '%s\n' "${STAGED}" | sed 's/^/  /' | head -20
[[ "${COUNT}" -gt 20 ]] && echo "  … и ещё $((COUNT - 20))"

# 3. Документация не должна тащить за собой код.
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

chmod +x "${HOOK}"
echo "pre-commit установлен: ${HOOK}"
echo "проверка на текущем состоянии:"
bash "${ROOT}/deploy/scripts/check-workspace.sh"
