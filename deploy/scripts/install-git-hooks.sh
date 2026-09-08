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

[[ -x "${CHECK}" ]] || exit 0

if ! "${CHECK}"; then
  echo "" >&2
  echo "pre-commit: коммит остановлен — сначала уберите посторонние файлы." >&2
  echo "            осознанно обойти: git commit --no-verify" >&2
  exit 1
fi
HOOK_BODY

chmod +x "${HOOK}"
echo "pre-commit установлен: ${HOOK}"
echo "проверка на текущем состоянии:"
bash "${ROOT}/deploy/scripts/check-workspace.sh"
