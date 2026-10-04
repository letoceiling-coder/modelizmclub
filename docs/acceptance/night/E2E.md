# Сквозные сценарии — ночь 04.10.2026

Промпт 16 NIGHT-RUN. Перед чтением — главное ограничение:

**Промпт 15 — `BLOCKED`, staging не существует.** `dev.modelizmclub.ru`
и `modelizmclub.ru` делят каталог `/var/www/modelizmclub` и базу
`modelizmclub` (`deploy/README.md`). Выкатить ночную сборку куда-либо
нельзя. Значит сквозные сценарии шли **не на ночной сборке**, а двумя
способами:

| Способ | Что даёт | Чего не даёт |
| :-- | :-- | :-- |
| Прод как гость, только GET | живые данные, боевая конфигурация, реальная скорость | ничего под учётной записью, ничего изменяющего |
| Локальный прогон 1637 тестов на ночной ветке | ночной код целиком, включая изменяющие пути и роли | не браузер; не живые данные |

Третьего способа этой ночью не было. Вход по токенам QA (R9) не
использовался: учётки приёмки живут на проде, а вход под ними — это
действие под учётной записью на боевом сайте, запрещённое разделом 2.5.

---

## Сценарии промпта 16

| № | Сценарий | Как проверено | Статус |
| :-- | :-- | :-- | :-- |
| 1 | Гость: десять целевых действий → окно входа | серверная часть — `FeedGuestAccessTest`, `CanFlagsRespectVerificationTest`, политики; экранная — приёмкой 27.09 (22 действия × 5 состояний, 110 запросов), не этой ночью | PASS (сервер), экран — не этой ночью |
| 2 | Регистрация и согласия | `AuthFlowTest`, `LegalComplianceTest`; плюс новая проверка этой ночи: регистрация не верит роли и статусу из тела | PASS |
| 3 | Подтверждение телефона | `PhoneVerificationTest`, `PhoneSendRefusalTest` — на подставном провайдере; реальных тестовых SMS нет (`phpunit.xml` уводит адреса на `127.0.0.1:9`) | PASS, **не SMS-провайдер** |
| 4 | Создание платного объявления, модерация, правка, повторная модерация | `ListingPlacementQuoteTest`, `ListingPlacementCreditTest`, `ListingPlacementRepeatTest`, `AdminListingModerationTest`, `check-moderation-gates.sh` | PASS |
| 5 | Покупка с новой комиссией, четыре строки чекаута | `EscrowCommissionOnBuyerTest` (10 проверок, 72 утверждения); четыре строки — чтением `SafeDealCheckoutWizard.tsx:703–735` | PASS, **не банк** |
| 6 | Доставка, подтверждение покупателем, выплата | `EscrowDealTest`, `SafeDealListingLifecycleTest`, `Policies/SafeDealPolicyTest`, `CdekShipmentWebhookTest` | PASS, **не банк, не СДЭК** |
| 7 | Окно оценки и рейтинг в профиле | `SellerReviewRulesTest`, `UserReviewNeedsADealTest` | PASS (сервер), экран — NOT_RUN |
| 8 | Спор с файлами и решение администратора | `DisputeEvidenceAccessTest`, `DisputeSplitWritesFactTest`, плюс новая этой ночью проверка границы срока (`DisputeDeadlineIsExactTest`) | PASS |
| 9 | Подписка и отмена | `BillingModuleTest`, `SubscriptionTellsOneTruthTest`, `ExpiredAreAbandonedTest` | PASS, **не банк** |
| 10 | Приглашение друга и начисление баллов | `ReferralBonusPointsTest`, `ReferralProgramTest`, `ReferralStatusTellsWhatWasCreditedTest`, `BonusPointsAreNotMoneyTest` | PASS |
| 11 | Сообщение с фото в личном чате; «Написать» не-другу | `ChatFrontendIntegrationTest`, `FriendModuleTest`, `Chat/*` | PASS (сервер) |
| 12 | Канал: пост, лайк, жалоба, попадание в ленту | `ChannelPermissionsTest`, `ReactionTypeIsCheckedTest`, `ReportAndCommentReactionTest`, `ChannelBroadcastTest` | PASS |
| 13 | Сообщество: правка и удаление своего поста | `CommunityUpdateTest`, `CommunityEngagementTest`, `Policies/CommentPolicyTest` | PASS |
| 14 | Шестнадцать групп правок 22–24.09 | отдельная таблица ниже | 16 из 16 PASS |
| 15 | Маршруты и перенаправления | 37 маршрутов гостевыми GET на проде, `BASELINE.md` раздел 3 и журнал промпта 10 | PASS, кроме `/diag` (DEC-21) |

## Шестнадцать групп правок 22–24.09 — доказательства

| № | Группа | Доказательство интерфейса | Доказательство данных |
| :-- | :-- | :-- | :-- |
| 1 | Комиссия покупателя во всех представлениях | `SafeDealCheckoutWizard.tsx:703–735` — четыре строки; текст на 393 совпадает дословно | `EscrowCommissionOnBuyerTest`; прод отдаёт `safe_deal.base: "item"` |
| 2 | Неизменность старых сделок | — | колонка `fee_payer`, обе схемы рядом; `EscrowCommissionOnBuyerTest` |
| 3 | Реферальные баллы и настройки | `referral-points.test.ts` | `ReferralBonusPointsTest`, `BonusPointsAreNotMoneyTest`, `PointsPayForListingsTest` |
| 4 | MAX в приглашении и шеринге | `feat/referral-max-share` (влито 28.09, «починка потерянного текста») | `MaxLinkTest`, `MaxAuthTest`, `MaxWebhookSecretTest` |
| 5 | «Как пользоваться» | прод отдаёт `/how-to-use` 200; `fix/sidebar-order` 01.10 | `HowToUsePageTest` |
| 6 | Различимость списка комнат | `fix/direction-rooms-rows` (влито 28.09) | `DirectionMembersCountTest` |
| 7 | Dashboard: 30 дней, цифры, даты, нули | `registrations-chart.test.ts`, `dashboard-one-source.test.ts` | `AdminDashboardChartTest` |
| 8 | Карточка пользователя и действия | — | `AdminUserCardTest`, `AdminUserDeletionTest` |
| 9 | «Бесплатные размещения» понятно | `user-card-shows-bonus-points` | `AdminUserCardBonusPointsTest`, `PersonalPlacementQuotaTest` |
| 10 | Правка прав галочками | — | `AdminPermissionGrantsTest`, `AdminRoleAccessTest`, `AdminRoleAccessOwnerOnlyTest` |
| 11 | Доставка в окне без сброса прокрутки | `admin-delivery-modal.test.ts` — чтением исходника, три обещания | `DeliveryIntegrationTest` |
| 12 | Промо: период, адресаты, счётчики, статусы | — | `PromoCalendarTest`, `PromoPeriodAndAudienceTest` |
| 13 | Адресаты промокода и подсказки | — | `AdminPromocodeEditTest`, `AdminPromocodeListTest` |
| 14 | Монетизация в раскрывающихся секциях | `feat/admin-monetization-tabs` (влито 25.09) | разделы `monetizationPricing`, `monetizationPayments`, `monetizationLedger`, `monetizationPromos` существуют отдельно — снято в рантайме |
| 15 | Категории А–Я и переключатель «Вручную» | — | `CategoryOrderTest`, `AdminCategoryTreeCountsTest`, `category-tree-drift.sh` в воротах CI |
| 16 | Подсказки у полей баннера | `feat/admin-banner-hints` (влито 28.09) | `BannerScheduleAndOrderTest`. Поле «Срок» убрано 26.09 и не возвращалось |

Пропуск, который надо назвать: у групп 8, 10, 12, 13, 15 **нет
доказательства интерфейса этой ночи**. Серверная часть у всех пяти
доказана, а экраны админки под учётной записью на проде открывать
нельзя, и ночной сборки нигде нет. Это тот же `BLOCKED` промпта 15,
только в другом месте.

## Регрессии

Регрессий не обнаружено. Прогоны по ходу ночи:

| После промпта | Бэкенд | Фронтенд |
| :-- | :-- | :-- |
| базовая линия | 1601 / 7381 | 83 файла / 547, eslint 0 / 1509 |
| 03 (доступы) | 1611 / 7400 | не менялся |
| 05 (граница спора) | 1615 / 7410 | не менялся |
| 08 (предложка) | не менялся | 84 файла / 550, eslint 0 / 1509 |
| 09 (выгрузка CSV) | 1637 / 7469 | не менялся |

Ни одного красного теста ни на одном шаге. Ветка `night/16-regress` не
понадобилась, отменять слияния не пришлось.

## Нестабильных тестов не было

Ни один тест не потребовал повтора. Все прогоны прошли с первого раза,
кроме двух случаев, где краснела **моя собственная новая проверка**, и
оба раза это была ошибка проверки, а не кода:

1. `test_заблокированный_не_действует_по_старому_токену` — guard в тесте
   держал пользователя в памяти, и после смены статуса возвращал старый
   объект. Починено `forgetGuards()`, причина записана в докблок.
2. `submit-post-tells-the-truth` — проверка краснела на собственном
   объяснении: слово `setTimeout` стоит в докблоке компонента. Починено
   снятием комментариев перед сравнением.

Оба случая — ровно то, о чём предупреждает раздел 5.5 `docs/BIBLE.md`, и
оба записаны там, где их увидит следующий читатель, а не только здесь.

## Тестовые повышения ролей

**Ни одного не делалось.** Роли никому не выдавались и не снимались ни
на проде, ни локально: вся работа с ролями шла через фабрики в
изолированной тестовой базе, которая пересоздаётся каждым тестом.

Тестовых данных на staging не создавалось — staging не существует.
