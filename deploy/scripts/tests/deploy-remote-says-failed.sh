#!/usr/bin/env bash
# Выкатка называет FAILED то, что не собралось.
#
# 29.09 сборка фронта оборвалась по нехватке кучи Node. Символическая
# ссылка осталась на прежнем релизе, сайт продолжал отдавать вчерашний
# фронтенд — а журнал выкатки закончился словом DONE. Отказ был виден
# только числом `frontend=134` в середине журнала: чтобы его заметить,
# надо было заранее знать, что смотреть.
#
# Проверка запускает НАСТОЯЩИЙ deploy-remote.sh в подменном дереве, а не
# пересказывает его логику: пересказ разойдётся с оригиналом ровно так же,
# как разошлись копия в /root и файл в репозитории (см. known-issues).
#
# Два прогона, и второй обязателен: без него «FAILED» мог бы печататься
# всегда, и проверка не умела бы отвечать «нет».
#
# Имена переменных латиницей. Первая версия этого файла была написана
# кириллицей — bash такие имена не принимает, каждое присваивание
# отвалилось с «not a valid identifier», а последняя строка всё равно
# напечатала «ок». Проверка, которая не может провалиться, хуже, чем её
# отсутствие.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STAND="$(mktemp -d)"
trap 'rm -rf "$STAND"' EXIT

# Подменные команды: настоящие systemctl, sudo и php на стенде не нужны и
# недоступны. Пусть молча соглашаются.
mkdir -p "$STAND/bin"
for name in systemctl sudo php curl; do
  printf '#!/bin/sh\nexit 0\n' > "$STAND/bin/$name"
  chmod +x "$STAND/bin/$name"
done
export PATH="$STAND/bin:$PATH"

# Дерево приложения: репозиторий с origin, чтобы `git fetch` и
# `merge --ff-only` отработали как на сервере.
ORIGIN="$STAND/origin"
TREE="$STAND/app"
git init -q --bare "$ORIGIN"
git clone -q "$ORIGIN" "$TREE" 2>/dev/null
cd "$TREE"
git config user.email stand@localhost
git config user.name stand
git checkout -q -b master 2>/dev/null || true
mkdir -p deploy/scripts backend
cp "$ROOT/deploy/scripts/deploy-remote.sh" deploy/scripts/

# Остальные шаги выкатки к делу не относятся — подменяем заглушками.
for step in backup-db.sh smoke-check.sh schema-drift.sh access-map-drift.sh; do
  printf '#!/usr/bin/env bash\necho "%s: заглушка"\n' "$step" > "deploy/scripts/$step"
  chmod +x "deploy/scripts/$step"
done

# $1 — код выхода сборки фронта. Печатает последнюю строку журнала выкатки.
run_once() {
  printf '#!/usr/bin/env bash\necho "сборка: код %s"\nexit %s\n' "$1" "$1" \
    > deploy/scripts/deploy-frontend.sh
  chmod +x deploy/scripts/deploy-frontend.sh
  git add -A >/dev/null
  git commit -qm "прогон $1"
  git push -q origin HEAD:master
  local sha
  sha="$(git rev-parse HEAD)"
  DEPLOY_APP_DIR="$TREE" bash deploy/scripts/deploy-remote.sh "$sha" >/dev/null 2>&1
  tail -1 "/tmp/deploy-$sha.log"
  rm -f "/tmp/deploy-$sha.log" "/tmp/deploy-fe-$sha.log"
}

broken="$(run_once 134)"
fine="$(run_once 0)"

errors=0
case "$broken" in
  FAILED*) ;;
  *) echo "сборка упала, а выкатка сказала: ${broken:-(пусто)}"; errors=1 ;;
esac
# Контроль. Без него «FAILED» мог бы стоять в журнале всегда.
case "$fine" in
  DONE*) ;;
  *) echo "сборка прошла, а выкатка сказала: ${fine:-(пусто)}"; errors=1 ;;
esac

# И отдельно — та самая причина падения.
#
# Лекарство («--max-old-space-size») было записано в known-issues 26.09 и
# три дня оставалось в документе: сам скрипт звал голый `bun run build`.
# Проверка запуском тут не годится — настоящая сборка идёт минутами и
# требует bun; смотрим, что предел задан.
if ! grep -q 'max-old-space-size' "$ROOT/deploy/scripts/deploy-frontend.sh"; then
  echo "deploy-frontend.sh собирает фронт без предела кучи Node — вернётся падение 29.09"
  errors=1
fi

if [ "$errors" -ne 0 ]; then
  echo "check-deploy-remote: выкатка отчитывается неверно"
  exit 1
fi

echo "check-deploy-remote: отказ сборки фронта назван отказом, успех — успехом"
