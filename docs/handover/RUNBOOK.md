# Runbook — для следующего разработчика

Выкатка, откат, копии базы, что смотреть при сбое. Состояние на 10.10.2026.

Перед первой правкой прочитайте `CLAUDE.md` в корне репозитория: там
записаны ловушки, каждая из которых уже стоила этому проекту одной аварии.

---

## Что где

| Что | Где |
| :-- | :-- |
| Сервер | `ssh -p 2222 root@31.207.75.124` |
| Код на сервере | `/var/www/modelizmclub` |
| Настройки (не в git) | `/var/www/modelizmclub/backend/.env` |
| Сборки фронтенда | `/var/www/modelizmclub/.worktrees/frontend-<метка>` |
| Журналы выкаток | `/var/log/modelizmclub/deploy-<sha>.log` |
| Журнал приложения | `/var/www/modelizmclub/backend/storage/logs/laravel.log` |
| Журнал nginx | `/var/log/nginx/error.log` |
| Копии базы | `/root/backups/auto/` + облако Selectel |
| Скрипт выкатки | `/root/deploy-remote.sh` (копия — `deploy/scripts/deploy-remote.sh`) |

Службы: `modelizmclub-frontend`, `modelizmclub-reverb`, `modelizmclub-worker`,
`modelizmclub-media-worker`, `php8.3-fpm`, `nginx`, `postgresql@16-main`,
`redis-server`, `livekit`, `coturn`.

---

## Выкатка

Порядок, от которого не отступать.

### 1. Слить по-человечески

```bash
# из рабочего дерева задачи
gh pr create --base develop --head <ветка>
# после зелёного CI
gh pr merge <номер> --merge

# из общего дерева
git checkout master && git merge --no-ff origin/develop && git push origin master
git checkout develop && git merge --ff-only master && git push origin develop
git checkout master
```

Последняя строка не формальность: `git merge` оставляет вас на той ветке, в
которую влили, и следующий коммит уходит в `master` мимо ветки. Так уже
случалось дважды.

### 2. Проверить CI **того коммита, который выкатываете**

```bash
export GH_TOKEN=$(gh auth token)
bash deploy/scripts/check-ci-status.sh "$(git rev-parse master)"
git rev-parse --short master   # то же число должно стоять в ответе
```

Ответов три, и путать нельзя: `0` зелёный, `1` красный, `2` — **выяснить не
удалось**. Третье не «всё хорошо».

> Скрипт ищет токен в переменной `GH_TOKEN`. Без неё он отвечает «спросить не
> удалось — Not Found», даже когда `gh` на машине авторизован. Строчка
> `export GH_TOKEN=$(gh auth token)` закрывает вопрос.

**Коммит слияния в `master` — другой коммит.** Его CI надо дождаться
отдельно: зелёный на ветке о нём ничего не говорит.

### 3. Выкатить

```bash
ssh -p 2222 root@31.207.75.124 "bash /root/deploy-remote.sh $(git rev-parse master)"
```

Скрипт сам: снимает копию базы, ставит заглушку, обновляет код, зависимости,
миграции, кеши, собирает фронтенд, перезапускает службы, снимает заглушку,
прогоняет проверку.

Вывода в терминал он почти не даёт — смотрите журнал:

```bash
ssh -p 2222 root@31.207.75.124 "tail -25 /var/log/modelizmclub/deploy-<полный-sha>.log"
```

Удачная выкатка кончается строкой `DONE … head=<короткий-sha>`.

### 4. Проверить, что код доехал

Совпадения номера коммита мало: файл мог откатить следующий коммит.

```bash
ssh -p 2222 root@31.207.75.124 "cd /var/www/modelizmclub && git rev-parse --short HEAD"
ssh -p 2222 root@31.207.75.124 "grep -c '<что-то-добавленное>' /var/www/modelizmclub/<файл>"
curl -s -o /dev/null -w '%{http_code}\n' https://modelizmclub.ru/
curl -s -o /dev/null -w '%{http_code}\n' https://api.modelizmclub.ru/api/v1/health
```

---

## Откат

### Весь выпуск

Запустить ту же выкатку с прежним номером:

```bash
ssh -p 2222 root@31.207.75.124 "bash /root/deploy-remote.sh <прежний-полный-sha>"
```

Прежние номера видно по журналам:

```bash
ssh -p 2222 root@31.207.75.124 "ls -1t /var/log/modelizmclub/deploy-*.log | grep -v deploy-fe | head -5"
```

**Если в выпуске были миграции — так откатить нельзя.** Применённую миграцию
симлинком не вернёшь: нужен дамп. Скрипт печатает готовую команду
восстановления прямо в журнал.

### Только фронтенд, за секунды

```bash
ssh -p 2222 root@31.207.75.124 "bash /var/www/modelizmclub/deploy/scripts/rollback-frontend.sh --list"
ssh -p 2222 root@31.207.75.124 "bash /var/www/modelizmclub/deploy/scripts/rollback-frontend.sh"
```

Без довода — на предыдущий релиз. Хранятся два последних.

### Настройки, менявшиеся в админке

Откат кода их не трогает. Что менялось — видно в журнале действий админки:
кто, когда, что было, что стало.

---

## Копии базы

| Когда | Куда |
| :-- | :-- |
| Перед каждой выкаткой | `/root/backups/auto/pre-deploy/<метка>-<sha>-pre-deploy.dump` |
| Каждую ночь | `/root/backups/auto/` + облако Selectel |

### Восстановление

```bash
ssh -p 2222 root@31.207.75.124
cd /var/www/modelizmclub/backend
php artisan down                      # закрыть сайт
pg_restore -d modelizmclub -c /root/backups/auto/pre-deploy/<файл>.dump
php artisan up
```

**Сначала проверьте дамп на копии базы, а не на боевой.** `-c` удаляет
существующие объекты: неудачное восстановление оставит базу пустой.

---

## Что смотреть при сбое

### Сайт не открывается

```bash
ssh -p 2222 root@31.207.75.124 "systemctl is-active modelizmclub-frontend nginx php8.3-fpm postgresql@16-main redis-server"
ssh -p 2222 root@31.207.75.124 "tail -40 /var/log/nginx/error.log"
```

### API отдаёт 500

```bash
ssh -p 2222 root@31.207.75.124 "tail -60 /var/www/modelizmclub/backend/storage/logs/laravel.log"
```

Причина обычно в последних строках, а не в трассировке. Полезно вытащить
только сообщения:

```bash
ssh -p 2222 root@31.207.75.124 "grep -ahoE '\"message\":\"[^\"]{0,200}' /var/www/modelizmclub/backend/storage/logs/laravel.log | tail -5"
```

Так за минуту нашлась причина поломки доставки Яндекса: `Error at path
'geo_id': Wrong type. Expected: kIntValue`.

### Весь API лёг разом

Почти всегда — кеш настроек. Проверка:

```bash
ssh -p 2222 root@31.207.75.124 "bash /var/www/modelizmclub/deploy/scripts/check-config-access.sh"
```

Должно быть: `.env` — права `640 root:www-data`, кеш настроек — `640`. Если
`.env` недоступен для `www-data`, приложение живёт только за счёт кеша, и
любая его чистка роняет сайт целиком.

**`config:clear` и `config:cache` на проде не запускать.** Чтобы php-fpm
увидел новый класс, достаточно `systemctl reload php8.3-fpm`.

### Общая проверка состояния

```bash
ssh -p 2222 root@31.207.75.124 "cd /var/www/modelizmclub && bash deploy/scripts/smoke-check.sh"
```

Проверяет разом: главную, API, схему базы, матрицу доступа, nginx, дерево
направлений, права `.env`, SMS-шлюз, ступени модерации, зависимости,
зависшие платежи, **куда уходят деньги**, кодировщик AVIF.

Отдельно про деньги:

```bash
ssh -p 2222 root@31.207.75.124 "cd /var/www/modelizmclub && bash deploy/scripts/check-live-money.sh --require-live"
```

`0` боевой, `1` испытательный, `2` выяснить не удалось. Сейчас отвечает
«открывать нельзя — контур не боевой».

---

## Разработка

### Каждая задача — в своём дереве

```bash
bash deploy/scripts/worktree.sh new fix/<задача>
bash deploy/scripts/worktree.sh list
bash deploy/scripts/worktree.sh done fix/<задача>
```

Общее дерево на две сессии не делится: `git add -A` однажды дважды за день
смёл чужую незакоммиченную работу в чужой коммит.

> Имя каталога берётся из последнего отрезка ветки. Две ветки одного дня —
> `docs/2026-10-09` и `handover/2026-10-09` — дают один и тот же каталог, и
> вторая не заведётся. Тогда руками:
> `git worktree add ../моделист-<имя> -b <ветка> origin/master`.

### Свои ворота перед коммитом

```bash
# фронтенд
cd frontend
NODE_OPTIONS=--max-old-space-size=6144 bun run build   # создаёт routeTree.gen.ts, без неё tsc врёт
bunx tsc --noEmit        # должно быть 0 ошибок
bunx eslint .            # 0 ошибок; предупреждения про точные px — прежние
bun run test

# бэкенд
cd backend
DB_DATABASE=modelizmclub_test__<дерево> php -d memory_limit=1024M vendor/bin/phpunit
```

> **Про память.** `php artisan test` падает с `Allowed memory size of
> 134217728 bytes exhausted` на середине: прогону нужно около 180 МБ. Довод
> `-d memory_limit` через `artisan test` не передаётся — он запускает phpunit
> отдельным процессом. Либо звать `vendor/bin/phpunit` напрямую, либо поднять
> `memory_limit` в `php.ini` до 512 МБ.

### Своя база на дерево

```bash
createdb -O modelizmclub modelizmclub_test__<дерево>
# и в backend/.env этого дерева:  DB_DATABASE=modelizmclub_test__<дерево>
```

Одна база на два дерева — это `migrate:fresh` одного прогона, роняющий схему
другому. Выглядит как поломка кода, а не как гонка.

### Ветка с миграциями пересобирает эталон схемы в себе

```bash
bash deploy/scripts/schema-drift.sh --update-baseline
git add backend/database/schema/objects.txt
```

Иначе CI краснеет в момент слияния по построению.

---

## Когда CI красный, а код ни при чём

Бывает. Ночью 10.10 `backend · phpunit` падал трижды подряд, и ни один раз
тесты не запускались: GitHub не мог скачать образ Postgres —
`toomanyrequests` от Docker Hub. Признак именно такой: в журнале прогона нет
ни одного имени теста, только повторы `docker pull`.

```bash
RUNID=$(gh api repos/Neeklo1606/modelizmclub/commits/<sha>/check-runs \
  --jq '.check_runs[] | select(.name=="backend · phpunit") | .id')
WF=$(gh api repos/Neeklo1606/modelizmclub/actions/jobs/$RUNID --jq '.run_id')
gh api -X POST repos/Neeklo1606/modelizmclub/actions/runs/$WF/rerun-failed-jobs
```

Предел обновляется примерно за час. **Выкатывать при красном CI, даже когда
причина понятна, без отдельного согласия нельзя.**

---

## Чего не делать

1. **Не выкатывать при красном или неизвестном CI.** Даже когда «причина
   понятна».
2. **Не запускать `config:clear` и `config:cache` на проде.**
3. **Не коммитить из общего дерева**, когда рядом заведены рабочие деревья.
4. **Не писать `git add -A`.** Только явные пути.
5. **Не проверять админку на живых людях.** Для этого есть три учётки
   `@qa.modelizmclub.ru`.
6. **Не считать возраст строки в базе простым `now() - created_at`.**
   PostgreSQL на сервере в UTC, приложение пишет московское время: разница
   ровно три часа, и выглядит правдоподобно.
7. **Не доверять «этого в коде нет» без полного чтения файла.** Найти можно
   `grep`'ом, не найти — нельзя.
