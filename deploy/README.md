# Деплой на VPS (dev.modelizmclub.ru)

Локальный Docker не используется. Все сервисы — на VPS Beget.

## Сервер

| Параметр | Значение |
|----------|----------|
| IP | 31.207.75.124 |
| ОС | Ubuntu 24.04 |
| Домен | dev.modelizmclub.ru |
| DNS | `*.modelizmclub.ru` → A 31.207.75.124 |
| Путь приложения | `/var/www/modelizmclub` |

## Стек на сервере

- nginx + PHP 8.3-FPM
- PostgreSQL 16
- Redis 7
- Certbot (Let's Encrypt)
- Supervisor (очереди Laravel)
- Node.js 22 + Bun (frontend на modelizmclub.ru)

## Backend (dev.modelizmclub.ru)

На сервере под root (один раз):

```bash
bash /var/www/modelizmclub/deploy/scripts/server-setup.sh
```

Скрипт устанавливает пакеты, создаёт БД, клонирует репозиторий, настраивает nginx и SSL.

## Обновление backend после push

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-dev.sh
```

После деплоя с поддержкой загрузки обзоров (видео до 200 МБ) — один раз:

```bash
bash /var/www/modelizmclub/deploy/scripts/setup-upload-limits.sh
```

Скрипт поднимает `upload_max_filesize` / `post_max_size` в PHP-FPM и `client_max_body_size` в nginx.

Проверка новых маршрутов:

```bash
bash /var/www/modelizmclub/deploy/scripts/smoke-new-routes.sh
bash /var/www/modelizmclub/deploy/scripts/run-server-tests.sh
bash /var/www/modelizmclub/deploy/scripts/run-qa-regression.sh
```

## Frontend (modelizmclub.ru)

Источник UI: [modelism-hub-connect](https://github.com/Neeklo1606/modelism-hub-connect) (TanStack Start + Nitro `node-server`).

Первичная настройка (один раз, **не затрагивает** dev API и другие vhost):

```bash
bash /var/www/modelizmclub/deploy/scripts/setup-frontend-vps.sh
```

Обновление после push:

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-frontend.sh
```

| URL | Назначение |
|-----|------------|
| https://modelizmclub.ru | production frontend (SSR, :3000) + API at `/api/v1` |
| https://api.modelizmclub.ru | Laravel API (same backend as modelizmclub.ru/api) |
| https://dev.modelizmclub.ru | Laravel API + Swagger (dev) |

`frontend/.env.production` → `VITE_API_BASE_URL=https://dev.modelizmclub.ru/api/v1`

## Переменные окружения

Файл `/var/www/modelizmclub/backend/.env` — **не в git**.

Обязательные ключи:

- `DB_*` — PostgreSQL на localhost
- `REDIS_*` — Redis на localhost
- `AWS_*` — Selectel S3
- `APP_URL=https://dev.modelizmclub.ru`

Эквайринг (оплата подписки/буста) — по умолчанию `BILLING_PROVIDER=stub`. Для prod:
`VTB_ACQUIRING_ENABLED=true` + `VTB_ACQUIRING_USERNAME` / `VTB_ACQUIRING_PASSWORD`, либо
`YOOKASSA_ENABLED=true` + `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` (см. `backend/.env.example`).

## CI

Тесты запускаются в GitHub Actions (без локального окружения). См. `.github/workflows/tests.yml` в `backend/`.

## Neeklo agent (neeklo.modelizmclub.ru)

Изолированный стенд для другого агента: **отдельная директория, БД, Reverb, frontend-порт**, тот же репозиторий, **другая git-ветка**.

| URL | Назначение |
|-----|------------|
| https://neeklo.modelizmclub.ru | frontend (SSR, :3002) |
| https://neeklo-api.modelizmclub.ru | Laravel API |
| wss://neeklo-ws.modelizmclub.ru | Reverb WebSocket (:8082) |

| Параметр | Значение |
|----------|----------|
| Путь | `/var/www/modelizmclub-neeklo` |
| БД | `modelizmclub_neeklo` (копия prod, дальше независима) |
| Git-ветка | `NEEKLO_GIT_BRANCH` (по умолчанию `neeklo`) |

DNS: A-записи `neeklo`, `neeklo-api`, `neeklo-ws` → `31.207.75.124` (или wildcard `*.modelizmclub.ru`).

Первичная настройка (один раз):

```bash
NEEKLO_GIT_BRANCH=neeklo bash /var/www/modelizmclub/deploy/scripts/setup-neeklo-vps.sh
```

Обновление после push в ветку neeklo:

```bash
NEEKLO_GIT_BRANCH=neeklo bash /var/www/modelizmclub-neeklo/deploy/scripts/deploy-neeklo.sh
bash /var/www/modelizmclub-neeklo/deploy/scripts/deploy-neeklo-frontend.sh
```

Учётные данные БД: `/root/modelizmclub-neeklo-db.env`


---

# Резервные копии базы и восстановление

## Что и куда сохраняется

`deploy/scripts/backup-db.sh` снимает дамп в формате `pg_dump -Fc`. Имя файла —
момент снятия плюс короткий хеш задеплоенного коммита, чтобы дамп всегда можно
было сопоставить с кодом, который сформировал схему:
`20260903T040000-4dd1901.dump`.

| Что | Где на сервере | Сколько хранится |
|---|---|---|
| Ежедневный | `/root/backups/auto/daily/` | 14 копий |
| Еженедельный (понедельник) | `/root/backups/auto/weekly/` | 8 копий |
| Перед деплоем | `/root/backups/auto/pre-deploy/` | 7 дней |
| Перед восстановлением | `/root/backups/auto/pre-restore/` | не удаляется автоматически |
| Все они же | S3, префикс `backups/` | 60 дней (lifecycle) |
| Лог запусков | `/root/backups/auto/backup.log` | — |
| Ошибки | `/root/backups/auto/FAILURES.log` | — |

Копия на той же машине бэкапом не считается, поэтому каждый дамп уходит в S3.
Если выгрузка не удалась, скрипт завершается ненулевым кодом и ротация **не
выполняется** — последние удачные копии не удаляются из-за сбойного запуска.

## Установка (один раз, на сервере)

```bash
cp /var/www/modelizmclub/deploy/systemd/backup-db.service          /etc/systemd/system/
cp /var/www/modelizmclub/deploy/systemd/backup-db.timer            /etc/systemd/system/
cp /var/www/modelizmclub/deploy/systemd/backup-db-failure@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now backup-db.timer
systemctl list-timers backup-db.timer --no-pager
```

Политику удаления в S3 старше 60 дней применить отдельно — см.
`deploy/s3/README.md`.

## Проверить, что бэкапы живы

```bash
systemctl list-timers backup-db.timer --no-pager   # когда следующий запуск
tail -20 /root/backups/auto/backup.log             # чем закончился прошлый
ls -lht /root/backups/auto/daily | head            # свежие файлы на месте
cat /root/backups/auto/FAILURES.log 2>/dev/null    # пусто = сбоев не было
```

Разовый прогон вручную: `systemctl start backup-db.service`.

## Восстановление — по шагам

**Шаг 1. Выбрать дамп.**

```bash
ls -lht /root/backups/auto/daily /root/backups/auto/weekly /root/backups/auto/pre-deploy
```

Если локальных копий нет, забрать из S3 (`backups/daily/…`) — например через
консоль провайдера или `aws s3 cp` с рабочей машины.

**Шаг 2. Проверить, что дамп читается,** прежде чем что-либо останавливать:

```bash
pg_restore -l /root/backups/auto/daily/20260903T040000-4dd1901.dump | head
```

**Шаг 3. Закрыть приложение,** чтобы во время восстановления не было записи:

```bash
cd /var/www/modelizmclub/backend && php artisan down
systemctl stop modelizmclub-worker.service
```

**Шаг 4. Восстановить.** Скрипт сам снимет дамп текущего состояния в
`pre-restore/` и спросит подтверждение — нужно ввести имя базы:

```bash
/var/www/modelizmclub/deploy/scripts/restore-db.sh \
  /root/backups/auto/daily/20260903T040000-4dd1901.dump
```

**Шаг 5. Поднять обратно:**

```bash
cd /var/www/modelizmclub/backend
php artisan migrate --force      # если дамп старее текущего кода
php artisan config:cache && php artisan route:cache
systemctl start modelizmclub-worker.service
php artisan up
```

**Шаг 6. Убедиться, что работает:**

```bash
bash /var/www/modelizmclub/deploy/scripts/smoke-new-routes.sh
curl -s -o /dev/null -w '%{http_code}\n' https://modelizmclub.ru/
```

## Если восстановление пошло не так

`restore-db.sh` перед перезаписью всегда кладёт дамп текущего состояния в
`/root/backups/auto/pre-restore/` и печатает его путь. Вернуться к тому, что
было до попытки:

```bash
/var/www/modelizmclub/deploy/scripts/restore-db.sh \
  /root/backups/auto/pre-restore/<файл>.dump --yes
```

## Восстановление в отдельную базу (без риска для прода)

Чтобы проверить дамп или достать из него данные, не трогая боевую базу:

```bash
sudo -u postgres createdb -O modelizmclub modelizmclub_check
/var/www/modelizmclub/deploy/scripts/restore-db.sh <дамп> --database modelizmclub_check --yes
# после проверки
sudo -u postgres dropdb modelizmclub_check
```

> **Важно:** `dev.modelizmclub.ru` и `modelizmclub.ru` используют один каталог
> `/var/www/modelizmclub` и **одну базу** `modelizmclub`. «Проверить на dev» не
> означает «безопасно» — для любых экспериментов заводите отдельную базу, как
> показано выше.
