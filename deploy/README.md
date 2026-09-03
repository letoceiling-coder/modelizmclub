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
bash /var/www/modelizmclub/deploy/setup/server-setup.sh
```

Скрипт устанавливает пакеты, создаёт БД, клонирует репозиторий, настраивает nginx и SSL.

## Обновление backend после push

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-dev.sh
```

После деплоя с поддержкой загрузки обзоров (видео до 200 МБ) — один раз:

```bash
bash /var/www/modelizmclub/deploy/setup/setup-upload-limits.sh
```

Скрипт поднимает `upload_max_filesize` / `post_max_size` в PHP-FPM и `client_max_body_size` в nginx.

Проверка новых маршрутов:

```bash
bash /var/www/modelizmclub/deploy/scripts/smoke-new-routes.sh
bash /var/www/modelizmclub/deploy/scripts/run-server-tests.sh
bash /var/www/modelizmclub/deploy/scripts/run-qa-regression.sh
```

## Frontend (modelizmclub.ru)

UI живёт в этом же репозитории, в каталоге `frontend/` (TanStack Start + Nitro
`node-server`). Деплой собирает именно его.

> Отдельный репозиторий `Neeklo1606/modelism-hub-connect` раньше значился здесь
> как «источник UI» — это больше не так. Он заморожен на коммите от 26.06.2026,
> работает на mock-данных без бэкенда и обслуживает только
> `front.modelizmclub.ru` (:3001, юнит `modelizmclub-front.service`). Ни один
> деплой-скрипт его не обновляет. Если поддомен больше не нужен — юнит и vhost
> можно выключить.

Первичная настройка (один раз, **не затрагивает** dev API и другие vhost):

```bash
bash /var/www/modelizmclub/deploy/setup/setup-frontend-vps.sh
```

### Обновление после push

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-frontend.sh
```

Что происходит внутри:

1. `git pull origin master`.
2. Сборка идёт в **изолированном git worktree** `.worktrees/frontend-<release>`,
   а не в живом `.output`. Раньше `bun run build` писал прямо в тот каталог,
   который читает работающий Node, и запрос, попавший в середину сборки, ловил
   уже удалённый chunk — так на стенде neeklo 14.07 пользователь получил
   error boundary.
3. Готовая сборка подключается **атомарной подменой симлинка** (`mv -Tf`):
   в любой момент `.output` указывает либо на целиком старый, либо на целиком
   новый релиз.
4. Перезапуск сервиса и smoke-check. Если проверка не прошла — симлинк
   автоматически возвращается на предыдущий релиз.
5. Хранятся **два последних релиза** — этого достаточно для отката.

### Откат фронта

Переключение на предыдущий релиз без пересборки, порядка нескольких секунд:

```bash
bash /var/www/modelizmclub/deploy/scripts/rollback-frontend.sh
```

Посмотреть, что доступно (звёздочкой отмечен текущий):

```bash
bash /var/www/modelizmclub/deploy/scripts/rollback-frontend.sh --list
```

Откатиться на конкретный релиз:

```bash
bash /var/www/modelizmclub/deploy/scripts/rollback-frontend.sh 20260903120000
```

Скрипт откажется работать, если каталог релиза отсутствует или в нём нет
`server/index.mjs`, и после переключения сам прогонит smoke-check.

### Проверка вручную

```bash
bash /var/www/modelizmclub/deploy/scripts/smoke-check.sh
```

Проверяет главную (200), `/api/v1/health` (200) и защищённый маршрут
(401 без токена — то есть авторизация жива). С `SMOKE_TOKEN=<token>`
дополнительно убеждается, что маршрут отвечает 200 с токеном.

| URL | Назначение |
|-----|------------|
| https://modelizmclub.ru | production frontend (SSR, :3000) + API at `/api/v1` |
| https://api.modelizmclub.ru | Laravel API (same backend as modelizmclub.ru/api) |
| https://dev.modelizmclub.ru | Laravel API + Swagger (dev) — **та же база, что и прод** |
| https://front.modelizmclub.ru | замороженный прототип (:3001), деплоем не обновляется |

Значения `VITE_*` задаёт `deploy-frontend.sh` при сборке; список и назначение —
в `frontend/.env.example`. Все они попадают в клиентский бандл и публичны.

## Деплой backend

```bash
bash /var/www/modelizmclub/deploy/scripts/deploy-dev.sh
```

Скрипт устроен так, что всё, что может отказать, срабатывает **до** первого
необратимого шага:

1. `git fetch` и, если скрипт изменился в master, перезапуск уже новой версии —
   до `reset --hard`, а не после.
2. Проверка рабочего дерева. Если есть изменения помимо артефактов сборки,
   деплой останавливается и печатает, как их сохранить, посмотреть или сбросить.
   Молча стирать работу, сделанную на сервере, скрипт не будет.
3. `reset --hard origin/master`.
4. `composer install`, затем сразу `config:cache` — без окна работы без кэша.
5. Проверка обязательных ключей в `.env`. Скрипт **не редактирует** `.env`:
   если чего-то не хватает, он останавливается и говорит, что дописать.
6. `backup-db.sh --pre-deploy` — дамп до миграций. Без него деплой не идёт.
7. `migrate --pretend` в `/var/log/modelizmclub/migrate-<release>.log` —
   что именно собирается измениться.
8. `artisan down --secret=<...>` — на время миграций. По секретной ссылке сайт
   остаётся доступен, чтобы проверить деплой до снятия заглушки.
9. `migrate --force`. При ошибке скрипт останавливается **в режиме заглушки** и
   печатает готовую команду восстановления из пред-деплойного дампа.
10. `artisan up`, `queue:restart`, перезапуск `modelizmclub-reverb` и
    `modelizmclub-worker` с проверкой, что они поднялись. Без этого воркеры
    продолжали бы выполнять код предыдущего релиза.
11. Smoke-check API. Автоотката здесь нет намеренно: откатить применённую
    миграцию симлинком нельзя — нужен дамп, и команда печатается в вывод.

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

