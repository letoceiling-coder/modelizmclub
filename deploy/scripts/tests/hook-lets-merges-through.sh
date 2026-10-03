#!/usr/bin/env bash
#
# Правило «документация и код в одном коммите» не мешает слиянию.
#
# Слияние этому правилу подчиниться не может: в сливаемом наборе лежит всё, что
# принесла другая ветка, и разделить его на два коммита нельзя. До 03.10
# `MERGING` смотрело только правило про общее дерево, и каждое слияние с
# конфликтом упиралось здесь — то есть требовало `--no-verify`, который снимает
# заодно и остальные проверки. Запрет, срабатывающий всегда, превращается в
# привычку его обходить.
#
# Проверка ставит хук в отдельный одноразовый репозиторий и делает там два
# коммита: обычный со смешением (обязан не пройти) и слияние со смешением
# (обязано пройти). Настоящий репозиторий не трогается.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INSTALLER="${ROOT}/deploy/scripts/install-git-hooks.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
ERRORS=0

[[ -f "${INSTALLER}" ]] || { echo "hook-lets-merges: нет ${INSTALLER}" >&2; exit 2; }

export GIT_CONFIG_GLOBAL="${WORK}/gitconfig"
git -C "${WORK}" init -q -b master
git -C "${WORK}" config user.email "t@t.t"
git -C "${WORK}" config user.name "test"

mkdir -p "${WORK}/backend/app" "${WORK}/docs" "${WORK}/deploy/scripts"
cp "${INSTALLER}" "${WORK}/deploy/scripts/"
echo "base" > "${WORK}/backend/app/A.php"
git -C "${WORK}" add -A >/dev/null 2>&1
git -C "${WORK}" commit -q -m "base" --no-verify

( cd "${WORK}" && bash deploy/scripts/install-git-hooks.sh >/dev/null 2>&1 )
[[ -x "${WORK}/.git/hooks/pre-commit" ]] || { echo "hook-lets-merges: хук не установился" >&2; exit 2; }

# 1. обычный коммит со смешением — обязан не пройти
echo "x" >> "${WORK}/backend/app/A.php"
echo "y" > "${WORK}/docs/B.md"
git -C "${WORK}" add backend/app/A.php docs/B.md >/dev/null 2>&1
if git -C "${WORK}" commit -q -m "смешение" >/dev/null 2>&1; then
  echo "  ПРОШЁЛ           обычный коммит со смешением документации и кода" >&2
  ERRORS=$((ERRORS + 1))
else
  echo "  ok    обычный коммит со смешением не прошёл"
fi
git -C "${WORK}" reset -q --mixed HEAD >/dev/null 2>&1 || true
git -C "${WORK}" checkout -q -- . 2>/dev/null || true
rm -f "${WORK}/docs/B.md"

# 2. слияние со смешением — обязано пройти
git -C "${WORK}" checkout -q -b side
echo "side" > "${WORK}/docs/C.md"
echo "side" >> "${WORK}/backend/app/A.php"
git -C "${WORK}" add docs/C.md backend/app/A.php >/dev/null 2>&1
git -C "${WORK}" commit -q -m "side" --no-verify
git -C "${WORK}" checkout -q master
echo "master" >> "${WORK}/backend/app/A.php"
git -C "${WORK}" add backend/app/A.php >/dev/null 2>&1
git -C "${WORK}" commit -q -m "master" --no-verify

git -C "${WORK}" merge --no-ff --no-commit side >/dev/null 2>&1 || true
# Конфликт в A.php разрешаем как угодно — важен сам факт слияния.
printf 'resolved\n' > "${WORK}/backend/app/A.php"
git -C "${WORK}" add backend/app/A.php docs/C.md >/dev/null 2>&1
if git -C "${WORK}" commit -q -m "merge: смешение неизбежно" >/dev/null 2>&1; then
  echo "  ok    слияние со смешением прошло"
else
  echo "  НЕ ПРОШЛО        слияние со смешением — правило требует --no-verify" >&2
  ERRORS=$((ERRORS + 1))
fi

if [[ "${ERRORS}" != "0" ]]; then
  echo "hook-lets-merges-through: находок — ${ERRORS}" >&2
  exit 1
fi
echo "hook-lets-merges-through: ok — обычное смешение запрещено, слияние проходит"
