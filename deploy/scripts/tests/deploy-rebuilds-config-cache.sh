#!/usr/bin/env bash
#
# Выкатка пересобирает кеш конфигурации, когда менялся `backend/config`.
#
# До 03.10 она его не трогала вовсе. На проде кеш лежал от 11 сентября — три
# недели любая правка в `config/` на прод не доезжала. Нашлось при закрытии
# CORS: `localhost:3000` оставался разрешённым к боевому API с учётными данными
# уже после выкатки правки, которая его убрала. `.env` при этом пуст, код
# новый, а приложение отвечает по старому умолчанию.
#
# Опаснее кеша маршрутов тем, что молчит: отсутствующий маршрут даёт 404, а
# старое умолчание отвечает двести — просто не тем значением.
#
# Проверка запускает НАСТОЯЩИЙ `deploy-remote.sh` в подменном дереве, по образцу
# `deploy-remote-says-failed.sh`. Настоящий сервер не трогается.
#
# Имена латиницей: кириллица в именах ломает bash молча.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
STAND="$(mktemp -d)"
trap 'rm -rf "${STAND}"' EXIT
ERRORS=0

LOGS="${STAND}/logs"
mkdir -p "${LOGS}" "${STAND}/bin"

# `php` печатает свои доводы — так видно, звали ли config:cache.
cat > "${STAND}/bin/php" <<'PHPSTUB'
#!/bin/sh
echo "php вызван: $*"
exit 0
PHPSTUB
# `sudo -u www-data php ...` должен дойти до заглушки php.
cat > "${STAND}/bin/sudo" <<'SUDOSTUB'
#!/bin/sh
while [ "$#" -gt 0 ]; do
  case "$1" in
    -u) shift 2 ;;
    *) break ;;
  esac
done
exec "$@"
SUDOSTUB
for name in systemctl curl chown; do
  printf '#!/bin/sh\nexit 0\n' > "${STAND}/bin/${name}"
done
chmod +x "${STAND}"/bin/*
export PATH="${STAND}/bin:${PATH}"

ORIGIN="${STAND}/origin"
TREE="${STAND}/app"
git init -q --bare "${ORIGIN}"
git clone -q "${ORIGIN}" "${TREE}" 2>/dev/null
cd "${TREE}"
git config user.email stand@localhost
git config user.name stand
git checkout -q -b master 2>/dev/null || true
mkdir -p deploy/scripts backend/config backend/bootstrap/cache
cp "${ROOT}/deploy/scripts/deploy-remote.sh" deploy/scripts/
for step in backup-db.sh smoke-check.sh schema-drift.sh access-map-drift.sh deploy-frontend.sh; do
  printf '#!/usr/bin/env bash\necho "%s: заглушка"\n' "${step}" > "deploy/scripts/${step}"
  chmod +x "deploy/scripts/${step}"
done
echo "<?php return [];" > backend/config/cors.php
: > backend/bootstrap/cache/config.php
git add -A >/dev/null
git commit -qm "основа"
git push -q origin HEAD:master

# Возвращает журнал выкатки после коммита, который трогает $1.
deploy_touching() {
  local path="$1"
  mkdir -p "$(dirname "${path}")"
  echo "// $(date +%s%N)" >> "${path}"
  git add -A >/dev/null
  git commit -qm "правка ${path}" >/dev/null
  git push -q origin HEAD:master
  local sha
  sha="$(git rev-parse HEAD)"
  DEPLOY_APP_DIR="${TREE}" DEPLOY_LOG_DIR="${LOGS}" \
    bash deploy/scripts/deploy-remote.sh "${sha}" >/dev/null 2>&1
  cat "${LOGS}/deploy-${sha}.log"
}

echo "deploy-rebuilds-config-cache: настоящая выкатка в подменном дереве"

# 1. правка в backend/config — кеш обязан пересобраться
log="$(deploy_touching backend/config/cors.php)"
if printf '%s' "${log}" | grep -q "config cache rebuilt"; then
  echo "  ok    правка config/ — кеш пересобран"
else
  echo "  НЕ ПЕРЕСОБРАН    правка config/ прошла, а кеш остался прежним" >&2
  ERRORS=$((ERRORS + 1))
fi
if printf '%s' "${log}" | grep -q "config:cache"; then
  echo "  ok    вызов config:cache виден в журнале"
else
  echo "  НЕТ ВЫЗОВА       config:cache в журнале не появился" >&2
  ERRORS=$((ERRORS + 1))
fi

# 2. правка вне config — кеш не трогаем: пересборка на каждой выкатке
#    была бы лишним риском, а правило «по факту правок» то же, что у маршрутов.
log="$(deploy_touching backend/app/Something.php)"
if printf '%s' "${log}" | grep -q "config cache rebuilt"; then
  echo "  ЛИШНЯЯ ПЕРЕСБОРКА правка вне config/ тоже пересобрала кеш" >&2
  ERRORS=$((ERRORS + 1))
else
  echo "  ok    правка вне config/ — кеш не тронут"
fi

if [[ "${ERRORS}" != "0" ]]; then
  echo "deploy-rebuilds-config-cache: находок — ${ERRORS}" >&2
  exit 1
fi
echo "deploy-rebuilds-config-cache: ok"
