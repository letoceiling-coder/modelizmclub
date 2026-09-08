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
| `modelizmclub-worker.service` | Очередь Laravel (`default`) |
| `modelizmclub-media-worker.service` | Очередь `media`: постеры и копии видео (ffmpeg) |
| `backup-db.timer` + `backup-db.service` | Ночной дамп базы в 04:00 с выгрузкой в S3 |
| `modelizmclub-scheduler.timer` + `.service` | Тик планировщика Laravel раз в минуту (`schedule:run`) |
| `backup-db-failure@.service` | Уведомление о неудачном дампе, вызывается через `OnFailure` |
| `neeklo-*` | То же для dev-контура `neeklo.modelizmclub.ru` |

### Установка на новом сервере или после правки юнита

```bash
cd /var/www/modelizmclub
for u in modelizmclub-frontend modelizmclub-front modelizmclub-reverb \
         modelizmclub-worker modelizmclub-media-worker; do
  install -m 644 "deploy/systemd/${u}.service" /etc/systemd/system/
done
install -m 644 deploy/systemd/backup-db.service          /etc/systemd/system/
install -m 644 deploy/systemd/backup-db.timer            /etc/systemd/system/
install -m 644 deploy/systemd/backup-db-failure@.service /etc/systemd/system/
install -m 644 deploy/systemd/modelizmclub-scheduler.service /etc/systemd/system/
install -m 644 deploy/systemd/modelizmclub-scheduler.timer   /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now modelizmclub-frontend modelizmclub-reverb \
                       modelizmclub-worker modelizmclub-media-worker
systemctl enable --now backup-db.timer
systemctl enable --now modelizmclub-scheduler.timer
```

`daemon-reload` обязателен: без него systemd продолжит использовать прежнюю
версию юнита, и правка не даст эффекта, хотя файл на диске уже новый.

### Проверить, что установлено всё

```bash
# юнит на сервере отличается от репозитория — значит правка не доехала
for u in modelizmclub-frontend.service modelizmclub-reverb.service \
         modelizmclub-worker.service modelizmclub-media-worker.service \
         backup-db.service backup-db.timer \
         modelizmclub-scheduler.service modelizmclub-scheduler.timer \
         "backup-db-failure@.service"; do
  diff -q "/var/www/modelizmclub/deploy/systemd/$u" "/etc/systemd/system/$u" >/dev/null 2>&1 \
    && echo "ok         $u" || echo "РАСХОДИТСЯ $u"
done

# таймеры живые и знают, когда сработают
systemctl list-timers backup-db.timer modelizmclub-scheduler.timer --no-pager
```

Первая команда 04.09 сразу нашла расхождение: установленный
`modelizmclub-frontend.service` был от 25.06 и не имел ни `ExecStartPost` с
проверкой отклика, ни `TimeoutStartSec`, добавленных в репозиторий позже. Юнит
жил своей жизнью три месяца, и заметить это было нечем.

Пустой вывод `list-timers` означает, что таймера нет вовсе, а не что он просто
ещё не срабатывал.

## Видео: постер и копия 720p

Лента отдавала исходник. Замер 06.09 на проде: один ролик в ленте, 14,1 МБ,
браузер тянул 140 КБ ещё до нажатия play, размеров кадра в базе не было вовсе.

Конвейер — сосед того, что делает варианты картинок, только кодирует ffmpeg:

* `Modules\Media\Jobs\ProcessVideoJob` → `Modules\Media\Services\VideoProcessor`;
* очередь `media`, воркер `modelizmclub-media-worker.service` (таймаут 1800 с);
* результат ложится в ту же колонку `media.variants`, в слоты `poster` и `720p`,
  и отдаётся тем же прокси: `/api/v1/media/<uuid>/poster.webp`,
  `/api/v1/media/<uuid>/720p.mp4`;
* попутно заполняются `width`, `height`, `duration_seconds` — без них карточка
  не знала пропорций кадра.

Кадр вытаскивает ffmpeg, а в WebP переводит GD: ffmpeg с libwebp собран на
сервере, но не везде, а GD с `imagewebp` уже несёт весь конвейер картинок.

Требуется `ffmpeg` и `ffprobe` в `PATH` пользователя `www-data`
(на сервере — `/usr/bin/ffmpeg`, версия 6.1.1). Без них задача пишет в лог
`media_video_skipped` и выходит: лента продолжает играть исходник, как раньше.

Догнать ролики, загруженные до появления конвейера:

```bash
cd /var/www/modelizmclub/backend
php artisan media:rebuild-videos --limit=50      # только те, у кого нет постера
php artisan media:rebuild-videos --limit=5 --force  # переснять уже готовые
```

Копия 720p пишется, только если она заметно легче исходника
(`MEDIA_VIDEO_MIN_SAVING`, по умолчанию 0,8). Ролик, уже снятый в 360p и сжатый,
перекодировать незачем — проверено на боевом файле: 14,1 МБ → 11,5 МБ, экономия
14 %, копия отбрасывается, лента играет оригинал по нажатию.

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

## Доступ к .env и кешу конфигурации

`backend/.env` должен читаться пользователем php-fpm, иначе сайт держится
только на `bootstrap/cache/config.php` и падает от любой чистки кеша — так
прод и лежал шесть минут 07.09.

Правильное состояние и починка:

```bash
chown root:www-data backend/.env && chmod 640 backend/.env
chmod 640 backend/bootstrap/cache/config.php
```

Второй chmod не про удобство: `config.php` — это запечённый `.env`, пароль
базы там открытым текстом, а файл был 644, то есть читал любой пользователь
сервера. Права 600 у самого `.env` при этом не закрывали ничего. Остальные
файлы в `bootstrap/cache` (routes, events, packages, services) секретов не
несут, их права трогать незачем.

Проверяет `deploy/scripts/check-config-access.sh`; он же вызывается из
`smoke-check.sh` после каждой выкатки, предупреждением.

## Переход на боевой ВТБ

Сейчас на проде `BILLING_PROVIDER=stub`: подписки и пополнения кошелька
оформляются через внутреннюю страницу-имитацию, денег никто не платит.
Все адреса ВТБ — тестовые контуры.

Порядок перехода, настройки на стороне банка и проверки первым платежом —
в [docs/vtb-go-live.md](docs/vtb-go-live.md). Ничего из этого не выполнено.

## nginx: репозиторий и сервер

Боевые конфиги лежат в `deploy/nginx/*.conf`. На сервере раскладка одна для
всех: файл в `sites-available`, симлинк на него в `sites-enabled`. Обычный
файл в `sites-enabled` — признак того, что источник правды раздвоился.

```bash
bash deploy/scripts/nginx-drift.sh      # что разошлось
nginx -t && systemctl reload nginx      # только после проверки
```

`nginx-drift.sh` вызывается из `smoke-check.sh` после каждой выкатки —
предупреждением, не приговором.

Разобранное 08.09:

| что | было | стало |
| --- | --- | --- |
| `modelizmclub.ru` | обычный файл в `sites-enabled` + осиротевшая копия в `sites-available` на 1089 байт меньше | симлинк как у всех, копия убрана в `/root/nginx-backup-*` |
| `dev.modelizmclub.ru` | `client_max_body_size 100M` на сервере против 1024M в репозитории | 1024M, как в репозитории и как у `api` |
| `turn.modelizmclub.ru` | потерянные пустые строки | по репозиторию |
| `api.modelizmclub.ru` | — | совпадал побайтово |

Направление везде «репозиторий → сервер». У `dev` это меняет поведение:
домен смотрит в тот же `backend/public` и тот же php-fpm, что и `api`, то
есть это вторая дверь в то же приложение. Дверь с лимитом 100M против 1024M
у соседней — источник загадочных 413 при заливке видео. Правка в репозитории
от 25.07 была осознанной, на сервер её просто не донесли.

## Кеш медиа

`/api/v1/media/` отдаётся через PHP и S3. Каждый запрос поднимал php-fpm и
читал файл из объектного хранилища — замер 07.09: постер 8,7 КБ в среднем
1,61 с, максимум 5,35 с.

Кеш описан в `deploy/nginx/api.modelizmclub.ru.conf`:
`fastcgi_cache_path /var/cache/nginx/media … keys_zone=media:16m max_size=2g
inactive=30d`.

**Почему такие числа.** `max_size=2g` — сейчас в `media` 310 записей и
310 МБ в S3; двух гигабайт хватает на весь текущий объём с запасом на рост,
а вытеснение по LRU снимает вопрос переполнения. `inactive=30d` и
`fastcgi_cache_valid 200 30d` — файлы неизменяемы: uuid выдаётся один раз,
содержимое по нему не меняется, ответ уже помечен
`immutable, max-age=31536000`. `keys_zone=16m` — около 128 тысяч ключей,
на порядок больше, чем записей в таблице.

Кешируются только ответы 200. Это безопасно по построению:
`ServeMediaController` отдаёт 200 лишь для публичных назначений, приватные
(вложения спора) уходят в 403 и в кеш не попадают.

Замер 08.09 с самого сервера, файл 16,5 КБ:

| | время |
| --- | --- |
| мимо кеша (php-fpm + S3) | 0,187–0,233 с |
| попадание в кеш | 0,0046–0,0067 с |

Тридцатикратная разница. Статус видно в заголовке `X-Media-Cache`.

## Планировщик Laravel

Тик раз в минуту даёт systemd, не cron. Юниты лежат в репозитории и совпадают
с установленными:

```bash
install -m 644 deploy/systemd/modelizmclub-scheduler.service /etc/systemd/system/
install -m 644 deploy/systemd/modelizmclub-scheduler.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now modelizmclub-scheduler.timer
```

Проверка, что живой:

```bash
systemctl list-timers --all | grep modelizmclub-scheduler
journalctl -u modelizmclub-scheduler.service --since "-5 min" | grep Running
```

Крон для планировщика не используется вовсе: `crontab -l` у `root`,
`www-data` и `modelizmclub` пуст. Искать планировщик по слову «laravel»
бесполезно — юнит называется `modelizmclub-scheduler`.

Что и как часто запускается (`backend/routes/console.php`), замер за сутки
08.09 по журналу:

| команда | расписание | запусков за сутки |
| --- | --- | --- |
| `posts:publish-scheduled` | каждую минуту | 1438 |
| `videos:publish-scheduled` | каждую минуту | 1438 |
| `safe-deals:auto-release` | раз в 15 минут | 96 |
| `delivery:sync-statuses` | раз в 15 минут | 96 |
| `subscription:check-expired` | в 00:05 | 1 |
| `communities:sync-counters` | в 03:30 | 1 |
| `notifications:prune` | в 03:50 | 1 |

Истечение брошенных чекаутов и продвижение выплат СБП живут внутри
`safe-deals:auto-release`; её вывод в расписании уходит в `/dev/null`,
поэтому для проверки её запускают руками — она идемпотентна:

```bash
sudo -u www-data php artisan safe-deals:auto-release
# Auto-released 0 safe deal(s); expired 0 abandoned checkout(s); advanced 0 payout(s).
```

Функциональная проверка 08.09: пост, назначенный на 03:34:25 UTC, ушёл из
`scheduled` тиком 03:34:01 и перешёл в `pending_moderation` — планировщик
отдаёт отложенную публикацию на модерацию, а не сразу в ленту.

## Учения: восстановление и откат

Обе процедуры проверены на боевом сервере 07.09.2026 и повторены 08.09. До
07.09 ни одна из них не запускалась ни разу за проект — дамп, который не
разворачивали, это надежда, а не бэкап. Повторять стоит после каждого
заметного изменения в деплое: второй прогон 08.09 занял четыре минуты и
подтвердил, что починка `PREVIOUS` держится.

### Восстановление из дампа

Проверяется весь путь целиком, включая выгрузку: дамп берётся **из S3**, а
не с диска сервера.

```bash
# 1. свежайший автоматический дамп (таймер backup-db.timer, ~04:00 UTC)
cd /var/www/modelizmclub/backend
php ../deploy/scripts/backup-db-download.php --list daily | head -3
php ../deploy/scripts/backup-db-download.php backups/daily/<ключ> /root/restore-drill/from-s3.dump

# 2. отдельная база — прод не трогаем
sudo -u postgres createdb -O modelizmclub modelizmclub_restore_test

# 3. КЛЮЧ --database ОБЯЗАТЕЛЕН.
#    Без него restore-db.sh берёт DB_DATABASE из .env, то есть боевую базу.
cd /var/www/modelizmclub
bash deploy/scripts/restore-db.sh /root/restore-drill/from-s3.dump \
  --database modelizmclub_restore_test --yes

# 4. сверка и уборка
bash deploy/scripts/schema-drift.sh --database modelizmclub_restore_test
sudo -u postgres dropdb modelizmclub_restore_test
```

Замеры:

| шаг | 07.09 | 08.09 |
| --- | --- | --- |
| скачивание из S3 | 0,94 с | 0,54 с |
| восстановление, включая страховочный дамп | 1,73 с | 1,94 с |
| **итого простоя в реальной аварии** | **менее 3 с** | **менее 3 с** плюс перезапуск приложения |

Прогон 08.09: дамп `20260908T015542-43d3792a.dump`, 866 КБ. 142 таблицы против
142 на проде, `schema-drift` — ноль расхождений, 2144 объекта. Десять ключевых
таблиц:

| таблица | прод | из дампа |
| --- | --- | --- |
| users | 17 | 17 |
| posts | 68 | 66 |
| listings | 33 | 33 |
| communities | 4 | 4 |
| channels | 9 | 9 |
| safe_deals | 21 | 21 |
| messages | 280 | 277 |
| comments | 48 | 47 |
| media | 310 | 310 |
| migrations | 88 | 88 |

Расхождения в `posts` (2), `messages` (3) и `comments` (1) — это работа,
проделанная на проде после снятия дампа в 01:55.

Результат: 142 таблицы против 142 на проде, `schema-drift` — ноль расхождений,
2144 объекта. Ключевые таблицы `users`, `posts`, `listings`, `communities`,
`channels`, `migrations` совпали точно; расхождения в `messages` (7),
`safe_deals` (3), `comments` (1) и `media` (1) — это работа, проделанная на
проде после снятия дампа в 04:01.

`restore-db.sh` перед перезаписью сам снимает страховочный дамп цели в
`/root/backups/auto/pre-restore/` и отказывается продолжать, если снять его
не удалось.

### Откат фронтенда

```bash
cd /var/www/modelizmclub
bash deploy/scripts/rollback-frontend.sh --list      # что доступно
bash deploy/scripts/rollback-frontend.sh --yes       # на предыдущий
bash deploy/scripts/rollback-frontend.sh <релиз> --yes
```

Замер 07.09, четыре переключения подряд: **2,5–4,2 с каждое, простоя нет**.
Опрос `http://127.0.0.1:3000/` раз в 200 мс во время переключения дал
321, 326, 322 и 329 успешных ответов и **ноль отказов** — подмена симлинка
с перезапуском службы укладывается между двумя опросами.

Повтор 08.09, откат и возврат: **3,19 с и 1,97 с, 16 и 12 успешных ответов,
ноль отказов**.

Проверять откат надо **по поведению, а не по имени каталога**. Хеш стилей
годится не всегда: 08.09 два соседних релиза отличались только правкой
в админке, и `styles-t427VZFu.css` у них общий. Тогда признаком служил сам
входной бандл — `index-CaLGIaJ1.js` против `index-DaPT4ZUy.js`, и в нём
число вхождений `confirm(`: 1 в новом релизе (там остался только запасной
путь в `lib/ui/ask`) против 3 в старом, где нативные окна ещё вызывались
напрямую. Признак выбирается под конкретную пару релизов — это должно быть
что-то, что правка меняла.

**Что учение нашло (07.09).** `rollback-frontend.sh` файл `.worktrees/PREVIOUS` только
читал, а записывал его один `deploy-frontend.sh`. После отката PREVIOUS
продолжал указывать на релиз, ставший текущим. Второй откат подряд — то есть
ровно тогда, когда первый не помог — отбрасывал такого кандидата и по правилу
«самый свежий по времени» возвращался на ту сборку, от которой ушли.
Исправлено: имя покидаемого релиза записывается после успешного смоука.
Повторное учение подтвердило — второй откат выбирает цель со строкой
`выбран: запись деплоя (.worktrees/PREVIOUS)`.

Проверка 08.09: до отката `PREVIOUS` = `frontend-20260908021721`, после
отката = `frontend-20260908022542` (тот, откуда ушли), после возврата снова
= `frontend-20260908021721`. Запись переворачивается на каждом переключении,
то есть второй откат подряд ведёт назад, а не по кругу.

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

# Планировщик Laravel

Всё, что должно происходить само — отложенная публикация постов и видео,
семидневное автосписание безопасной сделки, гашение брошенных чекаутов,
опрос СДЭК по статусам отправлений, снятие истёкших подписок, — живёт в
`backend/routes/console.php` и выполняется только если кто-то раз в минуту
зовёт `schedule:run`.

**06.09 выяснилось, что на проде его не звал никто.** Ни cron у root или
www-data, ни systemd-таймера, ни записи в supervisor; `storage/logs/scheduler.log`
был пустым файлом от 10 июля. Проверка «а есть ли планировщик» при этом даёт
ложноположительный ответ: `ps aux | grep schedule` находит живой
`schedule:work`, но он принадлежит **другому** приложению на той же машине —
`/var/www/modelizmclub-cloude`, база `modelizm_cloude`, домен
`dev-cloude.modelizmclub.ru`, юнит supervisor `modelizm-cloude-scheduler`.
Пути похожи, и это легко принять за свой.

Проверять поэтому надо по пути, а не по имени процесса:

```bash
systemctl list-timers modelizmclub-scheduler.timer --no-pager
journalctl -u modelizmclub-scheduler.service --since '-15 min' --no-pager
cd /var/www/modelizmclub/backend && php artisan schedule:list
```

Тик идёт от `www-data`, а не от root: артизан пишет `storage/logs` и
`bootstrap/cache`, и файлы, созданные root, php-fpm потом не перезапишет.

`withoutOverlapping()` на командах, которые ходят наружу, требует рабочей
блокировки в кэше. На проде это Redis (`CACHE_STORE=redis`); если он не
поднят, команды с этим модификатором не выполнятся вовсе. Проверка:

```bash
php artisan tinker --execute='Cache::lock("probe",5)->get(fn()=>true);'
```

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

Сколько это занимает — замерено 05.09 на боевом сервере, база 25 МБ,
141 таблица, дамп 808 КБ:

| Шаг | Время |
| --- | --- |
| Скачать дамп из S3 | 0,6 с |
| Страховочный дамп текущей базы | 0,3 с |
| `pg_restore` | 1,9 с |
| **Итого простоя базы** | **около 3 с** |

Это время самой операции. В настоящей аварии к нему добавляется всё, что
делает человек: понять, что случилось, выбрать дамп, поднять приложение
обратно. Сама база недоступна секунды.

**Шаг 1. Выбрать дамп.** Сначала локальные копии:

```bash
ls -lht /root/backups/auto/daily /root/backups/auto/weekly /root/backups/auto/pre-deploy
```

Если диска сервера больше нет — а ради этого случая бэкапы и существуют, —
дамп берётся из S3. Скачивание идёт через то же соединение, что и выгрузка:
учётные данные, endpoint и бакет читаются из конфигурации приложения. Ставить
`aws` CLI на сервер не нужно, его там нет.

```bash
cd /var/www/modelizmclub/backend
php ../deploy/scripts/backup-db-download.php --list daily          # что лежит в S3
php ../deploy/scripts/backup-db-download.php --latest daily /root/restore.dump
# или по конкретному ключу:
php ../deploy/scripts/backup-db-download.php backups/daily/20260905T040254-9daa91ea.dump /root/restore.dump
```

Скрипт сверяет размер скачанного с размером в хранилище и удаляет обрезанный
файл, а не оставляет его выглядеть годным.

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

Базу нужно создать заранее: `restore-db.sh` разворачивает дамп в существующую
базу и сам её не создаёт.

> **`--database` — единственная защита.** Без этого ключа скрипт берёт
> `DB_DATABASE` из `.env`, то есть боевую базу, и перезаписывает её. Ключ
> пишется первым, а не дописывается в конец команды.

### Как проверить, что восстановленная копия верна

```bash
# схема — против миграций, конфигурацию прода не трогая
deploy/scripts/schema-drift.sh --database modelizmclub_check

# число таблиц и строк по ключевым
for t in users posts listings messages communities channels safe_deals comments media migrations; do
  echo "$t: $(psql -d modelizmclub -tAc "SELECT count(*) FROM $t") / $(psql -d modelizmclub_check -tAc "SELECT count(*) FROM $t")"
done

# содержимое таблицы байт в байт
psql -d modelizmclub_check -tAc \
  "SELECT md5(string_agg(t::text, chr(10) ORDER BY t::text)) FROM listings t"
```

Расхождения по строкам ожидаемы: дамп снят раньше, чем сделана сверка, и всё,
что появилось на проде после, в копии отсутствовать будет. Смотреть надо не на
равенство чисел, а на то, объясняется ли разница временем: у разошедшихся строк
`updated_at` на проде должен быть **позже** момента снятия дампа.

### Проверка проведена 05.09.2026

Дамп `backups/daily/20260905T040254-9daa91ea.dump` взят **из S3**, а не с диска
сервера, и развёрнут в `modelizmclub_restore_test`:

- таблиц: 141 в обеих базах;
- сверка схемы восстановленной копии: `schema drift: none — 2132 objects`,
  то же число, что у прода;
- строки: `listings` 32/32, `communities` 4/4, `channels` 9/9, `safe_deals`
  6/6, `comments` 43/43, `migrations` 86/86; `users` 22/20, `posts` 63/61,
  `messages` 212/210, `media` 302/300 — разница ровно в том, что появилось
  на проде после 04:02;
- контрольные суммы `listings`, `safe_deals`, `comments`, `migrations`
  совпали байт в байт; `communities` и `channels` разошлись счётчиками
  участников и подписчиков, и у разошедшихся строк `updated_at` на проде —
  сегодняшний, то есть это пересчёт счётчиков после снятия дампа, а не
  потеря при восстановлении;
- тестовая база удалена после проверки.

Что чинилось по ходу: скачивания из S3 не существовало вовсе — процедура молча
предполагала, что дамп лежит на диске того же сервера; `schema-drift.sh` умел
сверять только базу из `.env`, то есть ради проверки копии пришлось бы
подменить конфигурацию прода.

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
