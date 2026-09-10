# Known issues — infrastructure / deploy scripts

Non-code problems found while working on the app, recorded here instead of
silently working around them each time, so they get fixed once at the
source.

## `deploy-neeklo-frontend.sh` does not `git pull`

**Found:** 2026-07-13, while deploying a hotfix for a production crash on `/feed`.

`deploy/scripts/deploy-neeklo-frontend.sh` builds and restarts the frontend
from whatever is *currently checked out* on the server — it never runs
`git pull`. Only `deploy/scripts/deploy-neeklo.sh` (the backend script) pulls.

Consequence: running the frontend-only deploy script after pushing new
frontend commits silently rebuilds the **old** code. The build succeeds,
the service restarts, everything reports "OK" — but the live site doesn't
change. This is easy to miss because there is no error; the deployed
JS chunk hashes just don't change.

**What happened concretely:** a hotfix commit was pushed, the frontend
deploy script was run, it reported success, but the site kept crashing
with the exact same error and the exact same JS chunk hash as before the
fix. Only checking `git log -1` on the server (and comparing asset
filenames) revealed the script had built stale code.

**Suggested fix:** add a `git pull origin <branch>` step to
`deploy-neeklo-frontend.sh` (mirroring what `deploy-neeklo.sh` already
does), or document clearly that the backend script must always run first
even for frontend-only changes.

**Workaround until fixed:** always run `git -C /var/www/modelizmclub-neeklo
pull origin neeklo` manually before invoking
`deploy-neeklo-frontend.sh`, and verify by diffing `git log -1` before/after
or checking that the built asset hash for a known-changed file actually
changed.

---

## Pre-deploy audit findings — 2026-07-14 (frontend)

Собрано в аудит-проходе перед финальным деплоем. Ничего из этого не блокирует
уже сделанные фиксы; это hygiene/follow-up + один реальный-режим блокер, зависящий
от бэкенда.

### ~~Мёртвый код / clutter~~ — закрыто 10.09.2026

**Чем подтверждено.** Проверено чтением дерева на 10.09: `AdBanner.tsx`
в репозитории нет, оба закоммиченных дубля (`lib/api/landing 2.ts`,
`lib/lucide-icon 2.ts`) удалены, `git ls-files | grep ' 2\.'` даёт ноль.
Про eslint запись тоже устарела: порог теперь ноль ошибок, и он держится
воротами.

Ниже — как было записано 14.07.

- **`frontend/src/components/AdBanner.tsx`** — компонент без единого импортёра
  (`grep` подтверждает 0 использований). Кандидат на удаление. Не влияет на
  сборку (tree-shaken), просто мёртвый файл.
- **Дубликаты `* 2.ts` / `* 2.tsx` в `frontend/src/`** — ~50 файлов-копий
  (артефакты копирования в Finder). Не импортируются (пути резолвятся к версиям
  без пробела). **2 из них закоммичены в git** и являются мёртвым трекнутым
  кодом: `frontend/src/lib/api/landing 2.ts`, `frontend/src/lib/lucide-icon 2.ts`.
  Остальные ~48 — untracked. Безопасны к удалению (не импортируются нигде).
- **eslint `no-unused-expressions`** в `EventsHero.tsx` (тернар-как-стейтмент
  `dx < 0 ? next() : prev();`, pre-existing паттерн) и `admin.tsx:1729`.
  Non-blocking: гейт сборки — `tsc --noEmit` (чист), `vite build` проходит;
  eslint в CI/деплое не запускается.

### Фаза 2b (иконки) — статические слоты подключены ✅ (2026-07-14)
- РЕШЕНО: `nav.*` слоты подключены через `<Icon slot={navSlotKey(section)} inheritColor>`
  во всех потребителях навигации (Sidebar обе колонки + «Маркет», BottomNav,
  бургер MobileHeader); `section.safe-deal` — в бейдже «Безопасная сделка»
  (`AdActionPanel`). `<Icon>` получил `inheritColor` (nav сохраняет active/inactive
  цвет от `currentColor` ссылки) и проброс `strokeWidth` (толщина активной вкладки
  BottomNav). Live-проверено: глифы без override не изменились, active/inactive
  цвет сохранён, override применяется к nav (Sidebar+BottomNav), fallback на lucide
  цел.
- `section.directions` НЕ заведён намеренно: у заголовков «Направления» нет иконки,
  слот был бы «мёртвым». Если нужна иконка рядом с «Направления» — отдельная правка.
- Оставшийся мелкий долг: `icon`-поля в массивах Sidebar/BottomNav/MOBILE_MENU_SECTIONS
  теперь vestigial (рендер идёт через ICON_SLOTS) — можно удалить в follow-up
  (оставлены, чтобы не плодить diff; держать в синхроне с ICON_SLOTS до удаления).

### Реальный режим — иконки заблокированы до бэкенда #26
- Публичный бутстрап `GET /icon-overrides` в НЕ-demo режиме отдаёт **404**
  (эндпоинт из `backend-endpoints-needed.md` #26 ещё не реализован). Ошибка
  ловится (`fetchIconOverrides` → `{}`), иконки корректно откатываются на lucide —
  **функционально безвредно**, НО в консоли на **каждой** странице в реальном
  режиме висит benign-404 до тех пор, пока Игорь не поднимет `#26`.
- Полный реальный тест загрузки иконок (POST /media purpose=icon, admin
  icon-assets, публикация) **невозможен до реализации `#26`** — это блокер именно
  для реального (не demo) теста иконок, а не дефект фронта. Demo-цикл проверен
  end-to-end (upload → sanitize/tokenize → reject multicolor → assign → publish →
  render в /feed → переживает reload).

## ~~`GET /users/me` answers 500~~ — закрыто 10.09.2026

**Чем подтверждено.** Замер на проде 10.09, без токена:

```
users/me                → 401
users/me/listings       → 401
wallet                  → 401
users/zzz-no-such-user  → 404
```

То есть и сам маршрут отвечает отказом вместо ошибки, и catch-all перестал
глотать несопоставленные пути: несуществующий слуг даёт 404, а не 500.
Записанная ниже причина при этом остаётся верной как урок — неограниченный
`{slug}` в конце префикса опасен сам по себе, и сметать его стоит в других
модулях тоже.

Ниже — как было записано 03.09.


**Found:** 2026-09-03, while writing the post-deploy smoke check
(`deploy/scripts/smoke-check.sh`). The check picked `/users/me` as its
"authenticated route" probe and failed on the first run against production.

```
GET https://api.modelizmclub.ru/api/v1/users/me   (no token)
→ 500 {"message":"Server Error"}
```

Every other protected route behaves correctly:

```
users/me/listings         401
me/entity-requests        401
wallet                    401
account/payment-methods   401
```

**Cause.** There is no `GET users/me` route at all — `backend/app/Modules/User/routes/api.php`
declares `me/stats`, `me/settings`, `me/interests`, … under `auth:sanctum` and
`PATCH me` under `auth:sanctum,verified`, but no bare `GET me`. The request
therefore falls through to the public catch-all on line 63:

```php
Route::get('{slug}', ShowProfileController::class);
```

which treats `me` as a profile slug, finds no such user, and throws instead of
returning 404.

**Why this is worth a task of its own.** The bug is not the missing route —
it is that an unauthenticated catch-all sits at the end of the `users` prefix
and absorbs every path that did not match something explicit. Any future typo,
renamed route or client calling a path that no longer exists lands in
`ShowProfileController` and surfaces as a 500. `{slug}` has no `where()`
constraint, unlike the `{id}` routes above it which are guarded with
`->whereNumber('id')`. The same shape may exist under other prefixes.

Worth checking as part of the F3 routing audit:
- constrain `{slug}` (a slug pattern, or an explicit exclusion list of reserved
  words like `me`), so unmatched paths 404 instead of reaching a controller;
- make `ShowProfileController` return 404 for a missing profile rather than
  throwing;
- sweep the other module route files for unconstrained catch-alls.

**Not fixed** — recorded deliberately. The smoke check probes
`users/me/listings` instead, so the deploy gate does not depend on this bug
being resolved first.

---

## `fb05263` содержит две несвязанные работы: ключи ВТБ и страницу `/post/{uuid}`

**Найдено:** 08.09.2026, в тот же день, что и сам коммит.

Ищущий, когда в проекте появилась отдельная страница записи, придёт сюда из
`git log --follow frontend/src/routes/post.$uuid.tsx` и увидит первым:

```
fb05263 docs(vtb): инвентаризация ключей и переписанный чек-лист перехода
```

Сообщение не врёт — оно просто описывает половину коммита. Вторая половина,
восемь файлов страницы записи, попала туда без ведома обеих сторон.

**Что в коммите на самом деле.** Инвентаризация ключей ВТБ: `deploy/docs/vtb-go-live.md`,
`deploy/docs/vtb-one-stage-wording.md`, `docs/context/80-payments.md`. Страница
записи: `frontend/src/routes/post.$uuid.tsx`, `frontend/src/routes/feed.tsx`,
`frontend/src/components/post/PostCard.tsx`, `frontend/src/lib/routes.ts`,
`frontend/src/lib/feed-guest-access/routes.ts`, три файла локалей,
`frontend/docs/backend-endpoints-needed.md`.

**Отчего.** Две сессии работали в одном рабочем дереве. Пока одна дописывала
страницу записи, вторая закончила свою работу и сделала `git add -A` — и
незакоммиченные чужие правки уехали вместе с её документами. Тем же днём и по
той же причине пострадал `DeliveryChoiceSheet.tsx`. Разбор и правила — в
CLAUDE.md, раздел «Параллельные сессии — каждая в своём worktree»; `git add -A`
с тех пор запрещён, а pre-commit останавливает коммит, где документация
смешана с кодом.

**Почему не исправлено.** Коммит слит в `master` и `develop` и запушен.
Переписывание опубликованной истории общих веток опаснее неточного сообщения:
у всех, кто уже подтянул эти ветки, работа разошлась бы с origin. Решение
принято осознанно 08.09.

**Что искать вместо `fb05263`.** Полная история страницы записи:

| Коммит | Что |
|---|---|
| `fb05263` | страница целиком, под чужим сообщением |
| `d4a63da` | убран задвоенный комментарий над `beforeLoad` в `feed.tsx` |
| `9244676` | точные px заменены шкалой Tailwind |
| `5495e70` | мерж `fix/post-page-stale-comment` в `master` |

Со стороны бэкенда к странице относится пункт 28
`frontend/docs/backend-endpoints-needed.md` — ссылка в уведомлениях
`subscription_posts` должна вести на `/post/{uuid}`, а не в начало ленты.

---

## ~~`CategoryTaxonomyTest` сравнивает идентификаторы разных таблиц~~ — закрыто 08.09

**Найдено:** 08.09.2026, при полном прогоне после добавления тестов модерации.

`test_listing_pair_maps_post_leaf_to_listing_ids_and_syncs_missing_mirror` и
`test_create_listing_accepts_post_taxonomy_id_when_listing_ids_differ`
утверждают `assertNotSame((int) $leaf->id, (int) $listingLeaf->id)` — где
`$leaf` лежит в `post_categories`, а `$listingLeaf` в `listing_categories`.
Это разные таблицы с разными последовательностями, и совпадут их номера или
нет — зависит от того, сколько строк успело появиться в каждой к этому месту
прогона.

Смысл у утверждения есть: оно защищает соседнюю проверку от вырождения —
если номера совпадут, «сервис перевёл один идентификатор в другой» нельзя
отличить от «сервис вернул то же число». Но выполняется оно по случайности,
а не по построению.

**Сегодня не сработало.** Два падения, которые я на это списал, оказались
гонкой двух прогонов за одну тестовую базу (см. ниже). После её устранения
все 634 теста зелёные, и правку под неверный диагноз я откатил. Но
случайность осталась случайностью: достаточно добавить пару категорий в
соседнем тесте.

**Закрыто в тот же день.** Случайность кончилась через несколько часов после
этой записи: пять тестов страницы тарифов добавили категорий объявлений,
последовательности сравнялись, и оба утверждения упали — при том, что файл по
отдельности проходил. Тогда же подтвердилось, что дело не в гонке: ни одного
чужого `phpunit`, ни одной чужой сессии в базе. То есть утром я откатил
правильную правку по неверному поводу, а к вечеру повод нашёлся настоящий.

Починено так, как и было написано: `ensureListingIdsAheadOfPostIds()` добивает
`listing_categories` строками, пока её следующий идентификатор не уйдёт выше
наибольшего у `post_categories`. Утверждение держится по построению.

---

## Тестовая база одна на все рабочие деревья

**Найдено:** 08.09.2026.

`phpunit.xml` жёстко задаёт `DB_DATABASE=modelizmclub_test`, а
`tests/TestCase.php` дополнительно отказывается работать с любым другим
именем — защита от того, чтобы прогон не снёс боевую базу. Правильная по
замыслу, но она же означает: два прогона из двух рабочих деревьев делят одну
базу и роняют друг другу схему.

Выглядит это не как гонка, а как поломка кода. Наблюдались все три вида:
`relation "migrations" does not exist`, `relation "users" already exists`,
`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`.
Последняя — верный признак двух одновременных `migrate:fresh`.

Отдельная подлость: гасить процесс надо не по имени `artisan test`, а по
`phpunit` — работает именно он, и `pkill -f "artisan test"` его не трогает.
Осиротевший `phpunit` продолжает пересоздавать таблицы, пока его не найдут
по `pg_stat_activity`.

**Как чинить:** имя базы с суффиксом рабочего дерева
(`modelizmclub_test_<basename>`), а проверку в `TestCase` смягчить до
префикса `modelizmclub_test`. Тогда защита остаётся, а деревья перестают
мешать друг другу.

**Пока не починено:** перед полным прогоном убедиться, что других нет —
`ps aux | grep [p]hpunit`.

---

## ~~Счётчик лайка не меняется~~ — закрыто 10.09.2026, не воспроизводится

**Чем подтверждено.** Полный проход 10.09 на боевом проде под подпиской:
шесть поверхностей, обычный режим движения и `prefers-reduced-motion:
reduce`, число читалось и через `innerText`, и через `textContent`.

| Где | Было | Стало | POST /react | Узлов со счётчиком |
| --- | --- | --- | --- | --- |
| Лента | 1 | 2 | 200 | 1 |
| Лента, reduced-motion | 1 | 2 | 200 | 1 |
| Страница записи | 2 | 1 | 200 | 1 |
| Просмотрщик | 1 | 2 | 200 | 1 |
| Сообщество | 2 | 1 | 200 | 1 |
| Профиль | 0 | 1 | 200 | 1 |

Двух чисел в кнопке нет нигде — а именно так дефект и выглядел.

**Отчего закрылось.** Замер, описанный ниже, сделан на master **до**
`f1abb70`. После него счётчик трогали пять коммитов: `9b5d61a`, `16559c4`,
`db0f6bb`, `02e1022`, `c93885f`. Каким из них закрылось — не разбирал:
дефекта нет ни на одной поверхности, и искать виновника починки незачем.

**Оговорка, которую стоит держать в уме.** У этого счётчика в истории уже
есть отменённое наблюдение — см. `8a9d48c`: «пустоту показывал innerText в
панели браузера, textContent отдавал верное число, четвёртая ошибка замера
за приёмку». Поэтому и сейчас читались оба свойства.

Ниже — как было записано 08.09.


**Найдено:** 08.09.2026, при проверке просмотрщика записи.

Нажатие на лайк перекрашивает сердце в акцентный цвет и уходит на сервер —
`POST /posts/{uuid}/react` отвечает 200, `stats.reactions` в API растёт. Но
число рядом с сердцем остаётся прежним: в разметке висит один
`<span class="tabular-nums">` со старым значением, новый не монтируется.

Замер на записи `e2f18b87-a760-453d-ba9b-d2264f6aa8b3`, ширина 1440:

| Момент | Число | opacity | Цвет кнопки |
| --- | --- | --- | --- |
| до нажатия | 2 | 1 | `rgba(26,26,30,0.7)` |
| через 0,4 с | 2 | 1 | акцент |
| через 2,4 с | 2 | 1 | акцент |

Дефект **в `master`**, не в ветке просмотрщика: замер выше сделан с
`git stash` — с убранными правками ветки, на чистой карточке ленты. В ветке
симптом тот же, отличается только застрявший узел (остаётся уходящий, с
`opacity: 0`).

Подозреваемый — `ReducedMotionSwitch` вокруг числа в `PostActions`: у него
уже была ровно такая история («два числа — старое видимое и новое с
opacity 0», см. комментарий в файле), и лечили её тем, что перевели кнопку
на общий переключатель. Значит, лечение закрыло не весь случай.

**Что это значит для пользователя:** лайкнул — сердце закрасилось, счётчик
врёт до перезагрузки страницы. Второй раз лайкать не станет, но и поверить
числу под записью нельзя.

**Не чинится в ветке просмотрщика:** правка лежит в общей строке действий
и в `ReducedMotionSwitch`, то есть касается каждой карточки ленты, а не
панели. Отдельной веткой, с проверкой на обеих — и в ленте, и в панели.

---

## ~~Приложение приколочено к русскому~~ — решено 10.09.2026

**Что решили.** Из двух названных ниже путей выбран второй: русский
признан единственным языком, английский и китайский словари удалены.

**Чем подтверждено.** Ветка `fix/russian-only` (`198f35e`) на проде.
В сборке не осталось ни одного чанка `en`/`zh` ни на клиенте, ни на
сервере — только `ru-admin`, который и должен грузиться отдельно. Поиск
английских подписей по `.output` даёт ноль. Из сборки ушло 560 КБ.

Заодно снят сам пин: `I18nProvider` больше ничего не выставляет и ничего
не стирает, `<html lang="ru">` стоит в разметке статически.

**Что это стоило.** Работа 05–08.09 по наполнению двух словарей отменена
осознанно: к моменту решения в них накопилось 489 непереведённых строк в
английском и 496 в китайском — русский текст под видом перевода. Дорога
назад открыта: `t()` и ключи на месте, вернуть язык — значит вернуть файл
словаря и загрузчик.

Ниже — как было записано 09.09.


**Найдено:** 09.09.2026, при проверке текстов в трёх локалях.

`I18nProvider` на каждом запуске делает `setLocale("ru")` и стирает
`mc_lang` из localStorage:

```tsx
if (i18n.language !== "ru") setLocale("ru");
window.localStorage.removeItem(LANG_KEY);
```

То есть выбранный язык не переживает перезагрузку, а поставить его извне
нельзя: ключ удаляется до того, как его прочитают. Проверено — записал
`mc_lang=en`, перезагрузил страницу, ключ снова пуст, `documentElement.lang`
равен `ru`.

**Что это значит.** Английский и китайский словари в сборке есть и растут:
05–08.09 в них добавлено 171 значение, отдельным файлом вынесен словарь
админки, 08.09 дозаполнены четыре ключа просмотрщика. Всё это сейчас
недостижимо для пользователя.

**И для правила проверки.** «Тексты смотри глазами в трёх локалях»
выполнить в браузере нельзя — переключателя нет. Пока это так, единственный
способ — читать сами словари; так и нашлись `reply` и `placeholder`,
лежавшие в китайском по-русски.

**Что решить.** Либо снять пин и вернуть переключатель языка, либо признать
русский единственным и перестать пополнять два мёртвых словаря. Выбор не
инженерный: он про то, нужны ли сайту другие языки к запуску.
## Шапка профиля не сводится с шапкой сообщества и канала

**Проверено:** 09.09.2026, при правке шапок сущностей.

`EntityHeader` — одна на сообщества и каналы. Профиль в неё не сводится, и
вот чем он отличается по существу, а не по оформлению:

| | EntityHeader | Профиль |
| --- | --- | --- |
| Обложка | только показывает | загрузка и кадрирование на месте, соотношение 3.5, вывод 1400×400 |
| Аватар | только показывает | своё меню «сменить / удалить», кадрирование |
| Заглушка обложки | градиент из имени | ровная заливка акцентом |
| Бейджи | слот от страницы | Pro, «первая сотня», статус телефона со ссылкой в настройки |
| Мета | одна строка caption | город, рейтинг, отзывы, сделки — с переходами по клику |

Свести их значило бы завести в `EntityHeader` флаги `editable`,
`onCoverChange`, `onAvatarChange`, `stats` — ровно то, от чего предостерегает
его собственная докстрока: «Флагов вида `isChannel` внутри нет — как только
такой понадобится, компоненты надо разводить обратно».

**Что при этом стоит знать:** кольцо-отбивка вокруг аватара, которого не
хватало сообществу и каналу, **в профиле уже было** —
`border: 4px solid var(--background)`. То есть приём в коде существовал, и
шапка сущности просто им не пользовалась. Разошлись не подходы, а две
реализации одного и того же.

**Если сводить всё же решим** — правильный порядок такой: сначала вынести
редактируемую обложку и редактируемый аватар в отдельные компоненты
(`EditableCover`, `EditableAvatar`), которые профиль передаёт слотами
`coverOverlay` и вместо `avatarUrl`. Тогда `EntityHeader` останется без
флагов, а профиль получит те же отступы и то же кольцо. Это отдельная ветка,
не правка отступов.

## Десять категорий без `path` и четыре с `depth`, спорящим с `parent_id`

**Измерено:** 09.09.2026, боевым прогоном `categories:flatten` на проде.

Команда приводит деревья к двум уровням и после записи сверяет результат
независимым запросом. Первый прогон дал 8 несошедшихся строк в направлениях
и 2 в каталоге — и ни одной из тех двух на дерево, которые команда писала.
Обе правленые строки легли верно; «путь есть, но не сходится с `parent_id`»
— ноль в обоих деревьях.

У всех десяти `path` не заполнен вовсе:

| Дерево | Строки |
| --- | --- |
| `post_categories` | #120 roboty, #121 gumanoid, #124 channels, #132 vodoemy, #133 prikormka-i-snasti, #134 dlya-rybalki, #137 akvarobot, #138 kotello |
| `listing_categories` | #98 escrow-smoke, #99 escrow-e2e |

Две последние — мусор от смоук-тестов эскроу, их можно просто убрать.

**Что важнее пустого пути.** Четыре строки — #121, #132, #133, #134 — имеют
`parent_id`, но `depth = 0`. Это ровно болезнь «ил 6»: дерево по `parent_id`
считает их подкатегориями, дерево по `depth` — корневыми направлениями.
«ил 6» из-за неё стоял в правой панели рядом с «Авиацией»; эти четыре стоят
там же сейчас — «Гуманоид» под «Роботами», «Водоёмы» и «Прикормка и снасти»
под «Рыбалкой», «Для рыбалки» под «Кораблями».

**Почему не починено вместе с «ил 6».** Починка «ил 6» была однозначной:
`path` называл родителя, и оставалось согласовать с ним `parent_id` и
`depth`. Здесь `path` пуст, и выбирать не из чего — вопрос «эти четыре
подкатегории или направления» решают не данные, а тот, кто заводил их
руками. Заполнить `path` по `parent_id` механически можно, но это тихо
утвердит один из двух ответов.

**Что решить:** чем должны быть эти четыре — подкатегориями своих родителей
или самостоятельными направлениями. После ответа правка на пять минут:
`categories:flatten` уже умеет приводить `depth` и `path` в согласие с
`parent_id`, надо лишь снять неоднозначность.

Проверка их не скрывает: она печатает каждую строку по номеру и слугу и
не валит прогон — расхождение настоящее, но не той правки, которая его
нашла.

## Поиск ищет по каталогу объявлений, а ведёт на страницу направления

**Измерено:** 09.09.2026, на проде.

`useGlobalSearch` берёт категории из `fetchListingCategories()` — это дерево
каталога объявлений. Обе панели поиска, десктопная и мобильная, ведут эти
строки на `/categories/$id`, а та страница читает `usePostCategories()` —
дерево направлений. Деревья разные: 25 категорий каталога против 41
направления, общих слугов 12.

Тринадцать категорий каталога направления не имеют вовсе: «Наборы», «Новые»,
«Б/у», «Редкие и коллекционные», «Собранные модели», «Инструмент», «Краски и
химия», «Декали и маски», «Запчасти и конверсии», «Литература», «Вторая
мировая» и два остатка эскроу-тестов. Найденная в поиске «Краски и химия»
ведёт на `/categories/paints`, где написано «Направление не найдено».

**Стало ли хуже от слугов.** Нет, стало лучше: раньше ссылка несла числовой
id каталога в маршрут направлений, и совпадение было случайным. Теперь по
двенадцати общим слугам она попадает верно, по тринадцати — честно упирается
в «не найдено» вместо чужой страницы.

**Что решить:** искать по направлениям (тогда результат ведёт туда, куда
ведёт) или оставить каталог, но вести на `/ads?taxonomy_id=…`. Первое ближе
к тому, что человек ожидает от строки «Направления» в выдаче.
