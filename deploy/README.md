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

## systemd-юниты

Каталог `deploy/systemd/` — источник правды для всех юнитов. Скрипты деплоя их
**не раскладывают**: `deploy-frontend.sh` обновляет код и перезапускает службу,
но файл юнита на сервере остаётся тем, что положили руками. Поэтому правка юнита
в репозитории доезжает до сервера только отдельным шагом, и именно из-за его
отсутствия таймер бэкапов простоял неустановленным с момента написания: команды
лежали в разделе про бэкапы, их никто не выполнил, а проверить было нечем.

| Юнит | Что делает |
|---|---|
| `modelizmclub-frontend.service` | Nitro на :3000, боевой фронтенд |
| `modelizmclub-front.service` | Nitro на :3001, поддомен front |
| `modelizmclub-reverb.service` | WebSocket-сервер Reverb |
| `modelizmclub-worker.service` | Очередь Laravel |
| `backup-db.timer` + `backup-db.service` | Ночной дамп базы в 04:00 с выгрузкой в S3 |
| `backup-db-failure@.service` | Уведомление о неудачном дампе, вызывается через `OnFailure` |
| `neeklo-*` | То же для dev-контура `neeklo.modelizmclub.ru` |

### Установка на новом сервере или после правки юнита

```bash
cd /var/www/modelizmclub
for u in modelizmclub-frontend modelizmclub-front modelizmclub-reverb modelizmclub-worker; do
  install -m 644 "deploy/systemd/${u}.service" /etc/systemd/system/
done
install -m 644 deploy/systemd/backup-db.service          /etc/systemd/system/
install -m 644 deploy/systemd/backup-db.timer            /etc/systemd/system/
install -m 644 deploy/systemd/backup-db-failure@.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now modelizmclub-frontend modelizmclub-reverb modelizmclub-worker
systemctl enable --now backup-db.timer
```

`daemon-reload` обязателен: без него systemd продолжит использовать прежнюю
версию юнита, и правка не даст эффекта, хотя файл на диске уже новый.

### Проверить, что установлено всё

```bash
# юнит на сервере отличается от репозитория — значит правка не доехала
for u in modelizmclub-frontend.service modelizmclub-reverb.service \
         modelizmclub-worker.service backup-db.service backup-db.timer \
         "backup-db-failure@.service"; do
  diff -q "/var/www/modelizmclub/deploy/systemd/$u" "/etc/systemd/system/$u" >/dev/null 2>&1 \
    && echo "ok         $u" || echo "РАСХОДИТСЯ $u"
done

# таймер живой и знает, когда сработает
systemctl list-timers backup-db.timer --no-pager
```

Первая команда 04.09 сразу нашла расхождение: установленный
`modelizmclub-frontend.service` был от 25.06 и не имел ни `ExecStartPost` с
проверкой отклика, ни `TimeoutStartSec`, добавленных в репозиторий позже. Юнит
жил своей жизнью три месяца, и заметить это было нечем.

Пустой вывод `list-timers` означает, что таймера нет вовсе, а не что он просто
ещё не срабатывал.

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

## Конфигурация сервера вне репозитория

Эти файлы правились прямо на проде и до 04.09 существовали в единственном
экземпляре — при пересборке машины восстанавливать их было бы неоткуда.
Здесь лежат копии; путь установки указан рядом.

| В репозитории | Куда ставится | Зачем |
| --- | --- | --- |
| `php-fpm/pool.d/www.conf` | `/etc/php/8.3/fpm/pool.d/www.conf` | Пул на 30 воркеров вместо пяти, `pm.status_path`, медленный лог с порогом 5 с |
| `nginx/fpm-status.conf` | `/etc/nginx/conf.d/fpm-status.conf` | Счётчики пула на `127.0.0.1:8081`, наружу не смотрят |
| `scripts/fpm-watch.sh` | `/usr/local/bin/fpm-watch.sh` | Раз в пять минут пишет счётчики в лог и поднимает тревогу при `max children reached` |
| `cron/fpm-watch` | `/etc/cron.d/fpm-watch` | Запуск предыдущего |
| `nginx/img.modelizmclub.ru.conf`, `nginx/livekit.modelizmclub.ru.conf`, `nginx/dev-cloude.modelizmclub.ru.conf` | `/etc/nginx/sites-available/` | Три вхоста, которых в репозитории не было |

Копии, а не источник истины: правка здесь сама на сервер не приедет.
Сверить расхождение:

```bash
ssh root@31.207.75.124 'cat /etc/php/8.3/fpm/pool.d/www.conf' | diff - deploy/php-fpm/pool.d/www.conf
```

## Сверка карты доступа

`deploy/scripts/access-map-drift.sh` сравнивает карту доступа, сохранённую в
`system_settings.feed.guest_access`, с умолчаниями из
`app/Support/FeedGuestAccessRegistry.php`.

Карта решает, кто что видит. 04.09 выяснилось, что `route.user` сохранён как
`auth`, хотя реестр объявляет `guest`, а роутер считает профиль публичным —
расхождение жило незамеченным и всплыло случайно. Это тот же класс, что дрейф
схемы, только последствия видит пользователь, а не миграция.

**Режим предупреждения, не блокировки.** Карту правят из админки осознанно,
поэтому расхождение — это новость, а не поломка. Недопустимо другое:
расхождение, о котором никто не знает. Поэтому список печатается после каждого
деплоя в `smoke-check.sh`; отключается через `SMOKE_SKIP_ACCESS_MAP=1`.

Вывод разделён намеренно: изменение `min_tier` двигает стену доступа, а
изменение `deny_mode` только выбирает вид окна — и сохранение карты из админки
переписывает `deny_mode` сразу во всех строках. Без разделения три десятка
строк второго рода прячут десяток первого.

```bash
deploy/scripts/access-map-drift.sh            # список расхождений, exit 0
deploy/scripts/access-map-drift.sh --strict   # exit 1 при любом расхождении
```
