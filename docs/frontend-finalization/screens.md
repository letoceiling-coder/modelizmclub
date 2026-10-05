# Экраны: маршрут × роль × ширина × состояние

Промпт 00. Заполнено по фактическому обходу стенда 05.10.2026, не по
списку из документов.

Полная таблица экранов по группам требует раздела 3.9 ТЗ, которого в
репозитории нет. Поэтому здесь — инвентаризация по факту: что есть в
`frontend/src/routes`, что из этого открывается гостем и на каких ширинах
проверено.

## Чем мерилось

Chromium 1194, локаль `ru-RU`, пояс `Europe/Moscow`, стенд
`http://127.0.0.1:3000` на настоящем API (`VITE_DEMO_MODE=false`).
`visibilityState = "visible"` проверен — иначе наблюдатели кадров молчат, и
замер означал бы «не измерялось», а не «ноль».

Ширины: **320, 360, 390, 1280**. Обязательный минимум правила 1 (360 и
1280) перекрыт. Ширины 430, 768, 1024, 1440, 1920 — не проверялись.

## Роли

Пройдена **одна**: гость.

Не заводились и не проверялись: А и Б (друзья), В (не друг А), с подпиской
и без, продавец с объявлением, владелец сообщества, администратор.
Это требование шага 4 промпта 00 и первая работа следующей сессии.

## Маршруты

Файлов маршрутов: **90**. Из них статических (без параметров) — **58**,
все обойдены гостем на четырёх ширинах.

### Обойдено гостем (58)

`/` · `/admin` · `/admin/design-system` · `/ads` · `/ads/new` · `/auth` ·
`/balance` · `/categories` · `/channels` · `/channels/new` ·
`/communities` · `/communities/new` · `/deals` · `/diag` · `/favorites` ·
`/feed` · `/friends` · `/help` · `/how-it-works` · `/how-to-use` ·
`/landing` · `/login` · `/messenger` · `/my-ads` · `/notifications` ·
`/oauth/vk/callback` · `/onboarding` · `/payment` · `/profile` ·
`/recover` · `/referral` · `/refund` · `/register` · `/reset-password` ·
`/reviews` · `/reviews/upload` · `/rules` · `/rules/tariffs` ·
`/safe-deal` · `/safe-deals` · `/settings` · `/settings/account` ·
`/settings/appearance` · `/settings/consents` · `/settings/dashboard` ·
`/settings/delivery` · `/settings/feedback` · `/settings/history` ·
`/settings/notifications` · `/settings/payment-methods` ·
`/settings/rating` · `/settings/requisites` · `/settings/security` ·
`/settings/spaces` · `/settings/wallet` · `/subscription` ·
`/verify-email` · `/wallet`

Итог обхода: **горизонтальной прокрутки нет ни на одном из 232 сочетаний**
маршрут × ширина. Разбор прочих показаний обхода — в `defects.md` §7.

### Не обойдено: маршруты с параметрами (13)

Нужны настоящие идентификаторы из базы стенда:

`/post/$uuid` · `/ads/$id` · `/user/$id` · `/communities/$id` ·
`/channel/$id` · `/categories/$id` · `/categories/$id/$subId` ·
`/deals/$uuid` · `/events/$uuid` · `/reviews/$id` · `/legal/$slug` ·
`/rules/$slug` · `/info/$slug` · `/r/$code` · `/pay/stub/$uuid` ·
`/admin/listings/$uuid`

Первая задача волны F1: собрать идентификаторы запросом к стенду и
дополнить обход.

### Переходы, замеченные при обходе гостем

| Маршрут | Куда уводит гостя |
| :-- | :-- |
| `/admin/design-system` | `/login` |
| `/settings` | `/settings/account` |
| `/landing` | `/` |

Эти три важны для замеров: страницу легко снять на середине перехода и
получить `main=0` или `h1=0` там, где всё в порядке. Выдержка под замер —
не меньше 2,5 с (`defects.md` §7.2).

## Состояния

Проверено одно: обычная загрузка маршрута гостем, прямым заходом по адресу.

Не проверено:

- переход внутри приложения против прямой загрузки — по `CLAUDE.md` это
  разные ветки, и расхождение между ними уже один раз держалось
  незамеченным;
- загрузка, пусто, ошибка с повтором;
- первый заход за сессию против повторного (на повторном данные из кэша, и
  фазы загрузки нет вовсе — `CLAUDE.md`);
- клавиатура телефона, безопасные зоны — `BLOCKED: проверяет владелец`.

## Слой запросов и заслон входа — что есть

Для шага 5 промпта 00, по факту чтения кода:

| Что | Где |
| :-- | :-- |
| Клиент API | `src/lib/api/client.ts`, база из `VITE_API_BASE_URL`, умолчание `https://api.modelizmclub.ru/api/v1` |
| Модули запросов | `src/lib/api/` — 40+ файлов по разделам |
| Заслон входа | `src/lib/gate/` — лестница `guest → registered → verified → subscriber`, одно окно на одну нехватку (`levels.ts`) |
| Токены оформления | `src/styles.css`, 297 объявлений переменных, шкала слоёв `--z-sticky … --z-call` |
| Маршруты API | 496 всего, 371 путь под `api/v1` |

Настоящие адреса, нужные волнам:

| Данные | Адрес |
| :-- | :-- |
| Направления | `GET /api/v1/categories/posts`, `/listings`, `/communities` |
| Тарифы | `GET /api/v1/plans` |
| Лендинг | `GET /api/v1/public/landing-blocks`, `/public/landing-stats` |
| Лента | `GET /api/v1/feed` |
| Объявления | `GET /api/v1/listings` |
| Переписка | `GET|POST /api/v1/conversations/{uuid}/messages` |
