# NIGHT-RUN — журнал прогона

Ночь 04.10.2026. Все команды выполнены этой ночью в дереве
`/Users/neeklo/моделист-night-2026-10-04`, если не сказано иное.

---

## Промпт 00 — Старт и проверка окружения

Начало 04.10 02:13 (WITA, UTC+8). Статус: DONE.

### Шаг 1. Окружение и git

```
date        Sun Oct  4 02:13:11 WITA 2026
pwd         /Users/neeklo/моделист
hostname    MacBook-Air---neeko.local
```

`git remote -v` — три remote, origin ведёт на фактический репозиторий:

```
letoceiling  github-letoceiling:letoceiling-coder/modelizmclub.git (fetch/push)
neeklo       git@github-neeklo:Neeklo1606/modelizmclub.git (fetch/push)
origin       git@github.com:Neeklo1606/modelizmclub.git (fetch/push)
```

Фактическое имя репозитория — **`Neeklo1606/modelizmclub`**. Имя
`modelism-hub-connect` из Библии 2.8 и 3.1 устарело (раздел 2.4 NIGHT-RUN
это предусматривает).

`git branch --show-current` → `develop`. `git log -5 --oneline`:

```
69f183e3 merge: fix/composer-clears-caches — кеши возвращаются после установки зависимостей
e6893253 fix: composer стирает кеши — выкатка их возвращает
6ea81896 merge: работа параллельной сессии с личного репозитория
a86e54f3 merge: docs/repo-transfer-2026-10-03 — разбор переноса
25b0f8e4 merge: chore/repo-moved-to-neeklo — адреса ведут на нового владельца
```

`git status --short` — три неотслеживаемых файла, все три документы этого
прогона: `BIBLE.md`, `NIGHT-RUN.md`, `МОДЕЛИЗМ — Библия финального
тестирования (сдача сервиса).md`. Чужих правок в общем дереве нет, но файлы
в нём есть, то есть дерево не чистое.

Монорепо подтверждено: в корне `backend/` и `frontend/`.

`BIBLE.md` в корне — побайтовая копия `docs/BIBLE.md` (`diff -q` молчит,
30 562 байта). Живой документ — `docs/BIBLE.md`.

### Шаг 2. origin и база ветки

`git fetch origin` — код возврата 0, `6ea81896..69f183e3 develop`.
`origin/develop` и `origin/master` указывают на один коммит
`69f183e3e4c6170f1a3fe623a23a336e32725349`. BASE_BRANCH существует.

### Шаг 3. Ночное дерево

Дерево общее не чистое, и рядом работают **58 worktree с ветками**
(`git worktree list`), большинство — от 22–26.09. По `CLAUDE.md` коммит из
общего дерева в такой обстановке запрещён хуком `pre-commit`. Поэтому ночь
идёт в отдельном дереве.

Отклонение от буквы промпта: NIGHT-RUN называет путь
`.claude/worktrees/night-2026-10-04`, а дерево заведено по правилу
`CLAUDE.md` — `/Users/neeklo/моделист-night-2026-10-04`. Причина: штатный
скрипт проекта `deploy/scripts/worktree.sh` кладёт деревья рядом с основным
и попутно ставит зависимости и подсказывает имя тестовой базы, а
`CLAUDE.md` требует пользоваться им. Запись об этом — в MORNING.md.

Штатный скрипт при запуске упал: `git fetch origin --quiet` внутри него
оборвался по ssh (`Connection to ssh.github.com closed by remote host`,
`client_loop: send disconnect: Broken pipe`), и `set -e` остановил скрипт до
создания дерева. Повторный fetch вручную прошёл. Дерево создано ручным
эквивалентом из `CLAUDE.md`:

```
git worktree add /Users/neeklo/моделист-night-2026-10-04 -b night/2026-10-04 origin/develop   # rc=0
```

`post-checkout` предупредил о двух соседних деревьях с незакоммиченным —
это ожидаемо и к ночной работе не относится.

Сразу после создания у ветки снят upstream:

```
git branch --unset-upstream
```

`git worktree add -b … origin/develop` ставит ветке upstream `origin/develop`,
и тогда безобидный `git push` без аргументов ушёл бы **в develop** — прямо
в запрет раздела 2.5. Теперь upstream нет, пуш требует явного адреса.

Зависимости поставлены в ночном дереве:

```
(frontend) bun install --frozen-lockfile    → 819 packages, rc=0
(backend)  composer install --no-interaction → rc=0
cp .env.testing.example .env && php artisan key:generate --force
```

### Шаг 4. Документы проекта

| Документ | Есть | Размер |
| :-- | :-- | :-- |
| `CLAUDE.md` | да | 59 917 Б |
| `docs/BIBLE.md` | да | 30 562 Б |
| `deploy/README.md` | да | 66 225 Б |
| `docs/qa-accounts.md` | да | 9 457 Б |
| `docs/known-issues.md` | да | 109 692 Б |
| `deploy/docs/vtb-go-live.md` | да | 41 527 Б |

Отсутствующих из списка промпта нет.

### Шаг 5. Библия v2.0

Найдена в корне репозитория: `МОДЕЛИЗМ — Библия финального тестирования
(сдача сервиса).md`, 2 117 строк / 159 895 байт. Прочитаны оба раздела:
Библия v2.0 (строки 1–488) и Production Acceptance Playbook (строки
490–2117). Структура снята `grep -an '^#\{1,3\} '` — 139 заголовков.

### Шаг 6. Инструменты и версии

| Инструмент | Версия / состояние |
| :-- | :-- |
| node | v22.22.0 |
| bun | 1.3.14 |
| php | 8.4.14 (cli) |
| composer | 2.9.2 |
| PostgreSQL (psql) | 16.13, локальный сервер принимает подключения на `/tmp:5432` |
| redis-server / redis-cli | **нет на машине** |
| gh | есть, `gh auth status` — вход как `Neeklo1606`, scopes `gist`, `read:org`, `repo` |
| lighthouse | есть (`/opt/homebrew/bin/lighthouse`) |
| Google Chrome | есть (`/Applications/Google Chrome.app`) — Lighthouse будет работать |
| ffmpeg / ffprobe | есть |
| playwright | модуль поставлен в `deploy/` этой ночью; браузеры в кеше `~/Library/Caches/ms-playwright` (chromium-1208/1234/1243) |

Отсутствие redis на тесты не влияет: `phpunit.xml` задаёт `CACHE_STORE=array`
и `QUEUE_CONNECTION=sync`.

### Шаг 7. Куда пойдут тесты бэкенда

`backend/phpunit.xml`: `DB_CONNECTION=pgsql`, `DB_HOST=127.0.0.1`,
`DB_PORT=5432`, `DB_DATABASE=modelizmclub_test`.

Боевая база — `modelizmclub` на сервере `31.207.75.124`. Хост тестов —
локальный `127.0.0.1`, имя другое. `tests/TestCase.php` держит защиту по
префиксу `modelizmclub_test` и бросает исключение до первой миграции, если
имя под префикс не подходит.

Для этого дерева заведена своя база, чтобы не столкнуться с соседними:

```
psql -d postgres -c "CREATE DATABASE modelizmclub_test__night_2026_10_04 OWNER modelizmclub;"
psql -d modelizmclub_test__night_2026_10_04 -c "GRANT ALL ON SCHEMA public TO modelizmclub;"
```

Прогон — с `DB_DATABASE=modelizmclub_test__night_2026_10_04`.
**Тесты бэкенда не BLOCKED.**

Отдельно: локально есть база с именем `modelizmclub` — это локальная копия,
не прод. Тесты к ней не пойдут (защита по префиксу).

### Шаг 8. Staging

```
curl -sS -o /dev/null -D - https://dev.modelizmclub.ru/   → HTTP/2 200, nginx/1.24.0
curl -sS -o /dev/null -D - https://modelizmclub.ru/       → HTTP/2 200, nginx/1.24.0
dig +short modelizmclub.ru      → 31.207.75.124
dig +short dev.modelizmclub.ru  → 31.207.75.124
dig +short api.modelizmclub.ru  → 31.207.75.124
```

Один адрес на три имени. `deploy/README.md` подтверждает прямо:

> **Важно:** `dev.modelizmclub.ru` и `modelizmclub.ru` используют один каталог
> `/var/www/modelizmclub` и **одну базу** `modelizmclub`.

и в таблице окружений: «https://dev.modelizmclub.ru | Laravel API + Swagger
(dev) — **та же база, что и прод**».

Вывод: **отдельного staging не существует.** Выкатка «на staging» — это
выкатка на прод. По разделу 2.6 NIGHT-RUN и шагу 1 промпта 15 выкатка
не делается, промпт 15 получает BLOCKED, сквозные сценарии промпта 16
идут на локальном стенде.

### Шаг 9. Таблица возможностей

| Возможность | Доступно | Что из-за этого не проверяется |
| :-- | :-- | :-- |
| Тесты бэкенда (PHPUnit) | **да** — своя база `modelizmclub_test__night_2026_10_04` | — |
| Линтер, типы, сборка фронта | **да** — bun 1.3.14 | — |
| Локальный стенд | проверяется в промпте 01 | — |
| Сквозные тесты на staging | **нет** — staging не отделён от прода | сквозные идут локально; поведение именно боевой конфигурации не проверяется |
| Lighthouse | **да** — CLI + Chrome | — |
| Выкатка на staging | **нет** — один каталог и одна база с продом | промпт 15 BLOCKED: ночная сборка нигде не поднимается, репетиция отката не выполняется |
| Песочница ВТБ | **нет** — локально `BILLING_PROVIDER=stub`, ключей ВТБ в репозитории и в локальном `.env` нет | банковская часть сделки и подписок — только на подставном провайдере, помечается «не банк» (ожидаемо по R6) |
| Тестовый СДЭК | **нет** — ключей СДЭК в локальной конфигурации нет | расчёт тарифов и вебхуки СДЭК — только на подставном провайдере |
| Тестовые SMS | **нет** — `phpunit.xml` уводит `IQSMS_ACCESS_POINT` и адреса МТС на `http://127.0.0.1:9` (заведомо закрытый порт) | подтверждение телефона проверяется только кодом и тестами, не реальной доставкой |
| Playwright для браузерных проверок | **да** | — |
| `gh` для pull request | **да**, scope `repo` | — |

### Условия полной остановки (раздел 2.1, пункт 4)

| Условие | Выполнено |
| :-- | :-- |
| Репозиторий не тот | нет — `Neeklo1606/modelizmclub`, тот самый |
| Рабочая копия на боевом сервере | нет — локальный MacBook |
| Невозможно создать ветку | нет — `night/2026-10-04` создана |
| Тестовая база указывает на боевую | нет — `modelizmclub_test__night_2026_10_04` локально |

Останавливаться не нужно, прогон продолжается.
