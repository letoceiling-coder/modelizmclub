#!/usr/bin/env bash
# Выкатка одного коммита на прод. Запускается на сервере под nohup, пишет в лог.
#
# Копия лежит на сервере в /root/deploy-remote.sh. До 25.09 её там и не было
# больше нигде: скрипт, которым выкатывается прод, жил вне репозитория —
# его нельзя было ни прочитать в ревью, ни откатить, ни узнать, что он
# изменился.
#
#   bash deploy-remote.sh <полный-sha>
#
# Второй довод `routes` раньше требовался, чтобы пересобрать кеш маршрутов.
# Его не передавал никто: в каждом журнале с 19.09 стоит `routes=no`, и
# кеш пролежал шесть дней, пока в нём не хватился новый путь — отвечавший
# 404 при живом коде. Теперь довод не нужен, скрипт смотрит сам; принимать
# его продолжаем, чтобы прежние вызовы не падали.
set -uo pipefail
SHA="$1"; ROUTES="${2:-auto}"; LOG="/tmp/deploy-$SHA.log"
cd /var/www/modelizmclub
{
  echo "start $(date -Is) sha=$SHA routes=$ROUTES"
  bash deploy/scripts/backup-db.sh --pre-deploy 2>&1 | tail -1 || { echo "FAIL backup"; exit 1; }
  git fetch -q origin && git merge --ff-only "$SHA" 2>&1 | tail -1 || { echo "FAIL merge"; exit 1; }
  echo "head $(git rev-parse --short HEAD)"
  git diff --stat HEAD@{1} HEAD -- backend/database/migrations backend/routes backend/app/Modules/*/routes | tail -3
  if git diff --name-only HEAD@{1} HEAD -- backend/database/migrations | grep -q .; then
    (cd backend && sudo -u www-data php artisan migrate --force 2>&1 | tail -5) || { echo "FAIL migrate"; exit 1; }
  fi
  # Кеш маршрутов — по факту правок, а не по слову в вызове.
  #
  # Новый путь при живом кеше отвечает 404, и это не похоже на
  # «забыли пересобрать»: выглядит как «маршрута нет», то есть как
  # ошибка в коде. Шесть дней так и было.
  if [ "$ROUTES" = "routes" ] || git diff --name-only HEAD@{1} HEAD -- backend/routes backend/app/Modules/*/routes | grep -q .; then
    (cd backend && sudo -u www-data php artisan route:cache 2>&1 | tail -1)
    # Кеш пишется с 664 и содержит карту всех путей. Права — как у
    # config.php, по тем же причинам (см. CLAUDE.md про .env).
    chmod 640 backend/bootstrap/cache/routes-v7.php 2>/dev/null || true
    echo "route cache rebuilt"
  fi
  systemctl reload php8.3-fpm && systemctl restart modelizmclub-worker modelizmclub-media-worker && echo reloaded
  bash deploy/scripts/deploy-frontend.sh > "/tmp/deploy-fe-$SHA.log" 2>&1; echo "frontend=$?"; tail -1 "/tmp/deploy-fe-$SHA.log"
  bash deploy/scripts/smoke-check.sh 2>&1 | tail -1
  bash deploy/scripts/schema-drift.sh 2>&1 | tail -1
  bash deploy/scripts/access-map-drift.sh 2>&1 | head -1
  echo "DONE $(date -Is) head=$(git rev-parse --short HEAD)"
} > "$LOG" 2>&1
