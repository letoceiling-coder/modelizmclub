# 10 — Дерево проекта

Срез `origin/master` @ `ecb4d60`, 03.09.2026. Строки считаются только для
текстовых файлов; бинарные (изображения, видео) учтены в количестве файлов
с нулём строк.


## `backend/`

| Каталог | Файлов | Строк |
|---|---:|---:|
| `.github/` | 4 | 84 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`workflows/` | 4 | 84 |
| `app/` | 668 | 45828 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Console/` | 16 | 2163 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Commands/` | 16 | 2163 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Enums/` | 28 | 523 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Http/` | 9 | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Controllers/` | 2 | 60 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Middleware/` | 6 | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Models/` | 103 | 5051 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Modules/` | 481 | 35268 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Account/` | 34 | 1204 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Admin/` | 78 | 5478 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Auth/` | 33 | 3410 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Billing/` | 46 | 5187 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Call/` | 7 | 625 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Catalog/` | 13 | 927 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Channel/` | 13 | 1359 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Chat/` | 26 | 1895 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Community/` | 21 | 1559 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Delivery/` | 41 | 2588 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Feed/` | 33 | 2160 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Legal/` | 15 | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Listing/` | 30 | 2324 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Media/` | 17 | 1771 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`PublicContent/` | 19 | 836 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Report/` | 5 | 268 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`User/` | 33 | 2014 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Video/` | 16 | 913 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Services/` | 8 | 693 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Sms/` | 6 | 453 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Support/` | 18 | 1435 |
| `bootstrap/` | 3 | 51 |
| `config/` | 27 | 2313 |
| `database/` | 114 | 13029 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`data/` | 3 | 6784 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`migrations/` | 84 | 4144 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`seeders/` | 25 | 2051 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`data/` | 8 | 0 |
| `public/` | 4 | 17 |
| `resources/` | 4 | 177 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`js/` | 2 | 5 |
| `routes/` | 4 | 88 |
| `scripts/` | 14 | 678 |
| `storage/` | 9 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`app/` | 2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`framework/` | 6 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`cache/` | 2 | 0 |
| `tests/` | 84 | 13420 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Feature/` | 70 | 12524 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Unit/` | 13 | 841 |

## `frontend/src/`

| Каталог | Файлов | Строк |
|---|---:|---:|
| `assets/` | 13 | 99 |
| `components/` | 245 | 36544 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`access/` | 7 | 639 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`admin/` | 22 | 6650 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ads/` | 25 | 3588 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`wizard/` | 4 | 938 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`auth/` | 4 | 468 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`boot/` | 3 | 233 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`calls/` | 7 | 1120 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`channels/` | 6 | 982 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`communities/` | 8 | 1111 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`deals/` | 1 | 404 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`entity-requests/` | 1 | 385 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`feed/` | 17 | 3461 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`friends/` | 3 | 368 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`layout/` | 13 | 2005 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`legal/` | 4 | 457 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`media/` | 3 | 993 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`messenger/` | 15 | 2984 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`post/` | 1 | 340 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`profile/` | 2 | 168 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`referral/` | 3 | 425 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`reviews/` | 7 | 528 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`settings/` | 4 | 443 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`subscription/` | 1 | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ui/` | 60 | 5588 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`ui-bespoke/` | 2 | 96 |
| `hooks/` | 3 | 43 |
| `lib/` | 142 | 29104 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`access/` | 2 | 131 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`api/` | 49 | 8502 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`auth/` | 6 | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`boot/` | 2 | 58 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`config/` | 4 | 302 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`feed-guest-access/` | 3 | 375 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`hooks/` | 10 | 488 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`i18n/` | 4 | 10210 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`locales/` | 3 | 10160 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`media/` | 2 | 76 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`realtime/` | 4 | 651 |
| `routes/` | 77 | 27024 |

## Топ-30 самых больших файлов

| # | Файл | Строк |
|---:|---|---:|
| 1 | `backend/database/data/russian_cities.json` | 6704 |
| 2 | `frontend/src/routes/admin.tsx` | 4427 |
| 3 | `frontend/src/lib/i18n/locales/en.ts` | 3446 |
| 4 | `frontend/src/lib/i18n/locales/zh.ts` | 3401 |
| 5 | `frontend/src/lib/i18n/locales/ru.ts` | 3313 |
| 6 | `frontend/src/routes/messenger.tsx` | 1846 |
| 7 | `frontend/src/lib/api/admin.ts` | 1772 |
| 8 | `frontend/src/routeTree.gen.ts` | 1694 |
| 9 | `frontend/src/routes/ads.new.tsx` | 1669 |
| 10 | `frontend/src/routes/profile.tsx` | 1376 |
| 11 | `frontend/src/routes/categories.$id.$subId.tsx` | 1295 |
| 12 | `frontend/src/lib/calls.ts` | 1198 |
| 13 | `frontend/src/routes/index.tsx` | 1180 |
| 14 | `frontend/src/routes/channel.$id.tsx` | 1151 |
| 15 | `backend/app/Modules/Billing/Services/SafeDealService.php` | 1137 |
| 16 | `frontend/src/routes/communities.$id.tsx` | 1112 |
| 17 | `backend/app/Modules/Chat/Services/ChatService.php` | 1044 |
| 18 | `frontend/src/lib/mock.ts` | 954 |
| 19 | `backend/app/Modules/Auth/Services/MaxAuthService.php` | 938 |
| 20 | `backend/tests/Feature/ChatFrontendIntegrationTest.php` | 899 |
| 21 | `frontend/src/lib/store.ts` | 880 |
| 22 | `backend/app/Console/Commands/SimulateActivityCommand.php` | 832 |
| 23 | `backend/app/Modules/Listing/Services/ListingService.php` | 805 |
| 24 | `frontend/src/components/feed/CommentSection.tsx` | 796 |
| 25 | `frontend/src/components/admin/BannersAdminCard.tsx` | 788 |
| 26 | `frontend/src/components/PostCard.tsx` | 769 |
| 27 | `frontend/src/routes/channels.index.tsx` | 757 |
| 28 | `frontend/src/components/ui/sidebar.tsx` | 744 |
| 29 | `frontend/src/lib/demo-data.ts` | 741 |
| 30 | `frontend/src/routes/my-ads.tsx` | 712 |

**Итого:** backend — 75916 строк в 949 файлах; frontend/src — 95289 строк в 485 файлах.

## Замечания

**`backend/.github/workflows/` существует, но не работает.** Четыре файла
(`tests.yml`, `issues.yml`, `pull-requests.yml`, `update-changelog.yml`) — это
стоковый скелет `laravel/laravel`. GitHub Actions читает workflow **только из
`.github/workflows/` в корне репозитория**, а в корне `.github/` нет. Файлы
инертны: CI фактически не запускался ни разу.

**Три файла локализации — 10 160 строк.** `en.ts` 3446, `zh.ts` 3401,
`ru.ts` 3313. Это 22% всего кода `frontend/src`. Каждый разъезжается с
остальными независимо — отсюда 27 из 84 ошибок `tsc` (см. `01-baseline.md`).

**`routes/admin.tsx` — 4427 строк в одном файле.** Крупнее любого файла
бэкенда почти вчетверо и держит первое место по ESLint (959 замечаний).

**`SafeDealService.php` — 1137 строк**, самый большой на бэкенде. Вся логика
безопасной сделки в одном сервисе; разбор — в `80-payments.md`.
