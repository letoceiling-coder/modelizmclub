# 30 — Модель данных

103 модели в `backend/app/Models`, 84 миграции. Срез `origin/master` @ `ecb4d60`.
Связи извлечены из объявлений `hasMany`/`belongsTo`/`hasOne`/`belongsToMany`/
`morph*` в классах моделей.

## Ключевые таблицы контура сделок

Всё создано одной миграцией `2026_08_17_121000_create_safe_deals_tables.php`.

### `safe_deals`

| Поле | Тип | Комментарий |
|---|---|---|
| `uuid` | uuid unique | внешний идентификатор |
| `listing_id` | FK listings, nullable | `nullOnDelete` |
| `buyer_id` / `seller_id` | FK users | `cascadeOnDelete` |
| `amount_kopecks` | bigint | сумма сделки |
| `platform_fee_kopecks` | bigint, default 0 | **комиссия хранится в сделке** |
| `seller_payout_kopecks` | bigint | к выплате продавцу |
| `status` | varchar(30), default `created` | |
| `hold_transaction_id` | FK wallet_transactions | холд |
| `payout_transaction_id` | FK wallet_transactions | выплата |
| `refund_transaction_id` | FK wallet_transactions | возврат |
| `delivery_method`, `tracking_number` | varchar | |
| `paid_at`, `shipped_at`, `delivered_at` | timestamp | |
| `auto_release_at` | timestamp | автосписание |
| `completed_at`, `cancelled_at` | timestamp | |
| `metadata` | json | |

Индексы: `(buyer_id, status)`, `(seller_id, status)`.

> **`hold_expires_at` в схеме нет.** Срок жизни холда выражен через
> `auto_release_at`. Это разные вещи: первое — когда истекает удержание денег
> на стороне банка, второе — когда деньги уходят продавцу. При переходе на
> реальный двухстадийный холд ВТБ понадобится отдельное поле.

### `disputes`

| Поле | Тип |
|---|---|
| `uuid` | uuid unique |
| `safe_deal_id` | FK safe_deals, cascade |
| `opened_by` | FK users |
| `reason` | varchar(100) |
| `description` | text nullable |
| `status` | varchar(30), default `open` |
| `resolution` | text nullable |
| `resolved_by` | FK users nullable |
| `resolved_at` | timestamp |
| `evidence` | **json** |

Индекс: `(safe_deal_id, status)`.

> **Файлы спора хранятся в json-поле `evidence`,** отдельной таблицы нет.
> Требование «до 5 файлов в споре» никак не выражено в схеме — ни ограничением,
> ни связью с `media`. Проверка количества, если она есть, живёт в коде.
>
> **Решения «разделить сумму X/Y» в схеме тоже нет** — только текстовое
> `resolution`. Частичный возврат невозможно записать структурно.

### `escrow_transactions` — журнал событий сделки

| Поле | Тип |
|---|---|
| `safe_deal_id` | FK safe_deals, cascade |
| `actor_id` | FK users nullable |
| `type` | varchar(40) — переход статуса или движение денег |
| `amount_kopecks` | bigint nullable |
| `wallet_transaction_id` | FK wallet_transactions nullable |
| `note` | text |
| `created_at` | timestamp (без `updated_at`) |

Индекс: `(safe_deal_id, type)`. Это и есть журнал событий сделки — append-only
по замыслу (нет `updated_at`).

## Модели по блокам


### Безопасные сделки

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `SafeDeal` | `(по имени класса)` | 26 | belongsTo:listing → Listing, belongsTo:shipment → Shipment, belongsTo:buyer → User, belongsTo:seller → User, hasMany:transactions → EscrowTransaction … +7 |
| `SafeDealIncomingPayment` | `(по имени класса)` | 23 | belongsTo:safeDeal → SafeDeal, belongsTo:payment → Payment, belongsTo:buyer → User, hasMany:gatewayEvents → SafeDealGatewayEvent |
| `SafeDealPayout` | `(по имени класса)` | 28 | belongsTo:safeDeal → SafeDeal, belongsTo:seller → User, hasMany:gatewayEvents → SafeDealGatewayEvent |
| `SafeDealGatewayEvent` | `(по имени класса)` | 9 | belongsTo:safeDeal → SafeDeal, belongsTo:incomingPayment → SafeDealIncomingPayment, belongsTo:payout → SafeDealPayout |
| `EscrowTransaction` | `(по имени класса)` | 7 | belongsTo:safeDeal → SafeDeal, belongsTo:actor → User |

### Споры

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Dispute` | `(по имени класса)` | 10 | belongsTo:safeDeal → SafeDeal, belongsTo:openedBy → User, belongsTo:resolver → User |

### Отзывы и рейтинг

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `UserReview` | `(по имени класса)` | 8 | belongsTo:author → User, belongsTo:target → User, belongsTo:safeDeal → SafeDeal |

### Просмотры и статистика

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `ListingViewDaily` | `listing_view_daily` | 3 | belongsTo:listing → Listing |
| `UserViewHistory` | `user_view_history` | 6 | belongsTo:user → User |
| `VideoView` | `(по имени класса)` | 4 | belongsTo:video → Video |

### Промо и подписки

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `PromoPool` | `(по имени класса)` | 11 | hasMany:users → User |
| `Promocode` | `(по имени класса)` | 11 | belongsTo:user → User, belongsTo:listingCategory → ListingCategory, hasMany:usages → PromocodeUsage |
| `PromocodeUsage` | `(по имени класса)` | 4 | belongsTo:promocode → Promocode, belongsTo:user → User, belongsTo:payment → Payment |
| `SubscriptionPlan` | `(по имени класса)` | 13 | — |
| `UserSubscription` | `(по имени класса)` | 7 | belongsTo:user → User, belongsTo:plan → SubscriptionPlan |
| `ListingPromotion` | `(по имени класса)` | 3 | belongsTo:listing → Listing |

### Посты и комментарии

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Post` | `(по имени класса)` | 17 | belongsTo:author → User, belongsTo:community → Community, belongsTo:category → PostCategory, belongsTo:subcategory → CommunitySubcategory, belongsTo:repostOf → self … +5 |
| `Comment` | `(по имени класса)` | 11 | morphTo:commentable → , belongsTo:author → User, belongsTo:parent → self, belongsTo:root → self, hasMany:replies → self … +1 |
| `CommentMedia` | `comment_media` | 3 | belongsTo:comment → Comment, belongsTo:media → Media |
| `CommentReaction` | `(по имени класса)` | 3 | belongsTo:comment → Comment, belongsTo:user → User |

### Сообщества

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Community` | `(по имени класса)` | 19 | belongsTo:category → CommunityCategory, belongsTo:city → City, belongsToMany:topicCategories → PostCategory, hasMany:events → CommunityEvent, hasMany:joinRequests → CommunityJoinRequest … +6 |
| `CommunityApplication` | `(по имени класса)` | 9 | belongsTo:user → User, belongsTo:category → CommunityCategory, belongsTo:reviewer → User |

### Каналы

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Channel` | `(по имени класса)` | 16 | belongsTo:owner → User, belongsTo:avatar → Media, belongsTo:banner → Media, hasMany:posts → ChannelPost, belongsToMany:subscribers → User … +1 |
| `ChannelApplication` | `(по имени класса)` | 13 | belongsTo:user → User, belongsTo:reviewer → User |

### Доставка

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Shipment` | `(по имени класса)` | 25 | belongsTo:listing → Listing, belongsTo:safeDeal → SafeDeal, belongsTo:conversation → Conversation, belongsTo:seller → User, belongsTo:buyer → User … +3 |
| `SellerDeliveryProfile` | `(по имени класса)` | 10 | belongsTo:user → User, belongsTo:city → City |

### Платежи и кошелёк

| Модель | Таблица | fillable | Связи |
|---|---|---:|---|
| `Payment` | `(по имени класса)` | 10 | belongsTo:user → User |
| `SavedPaymentMethod` | `(по имени класса)` | 7 | belongsTo:user → User |
| `Wallet` | `(по имени класса)` | 4 | belongsTo:user → User, hasMany:transactions → WalletTransaction |
| `WalletTransaction` | `(по имени класса)` | 11 | belongsTo:wallet → Wallet, belongsTo:user → User |
| `BonusAccount` | `(по имени класса)` | 2 | belongsTo:user → User, hasMany:transactions → BonusTransaction |
| `BonusTransaction` | `(по имени класса)` | 8 | belongsTo:account → BonusAccount |

### Остальные модели (70)

`AuditLog`, `Banner`, `BannerEvent`, `CallLog`, `ChannelPost`, `ChannelPostLike`, `ChannelPostMedia`, `ChannelPostView`, `City`, `ClientLog`, `CommunityCategory`, `CommunityEvent`, `CommunityJoinRequest`, `CommunitySubcategory`, `ConsentLog`, `Conversation`, `ConversationParticipant`, `CookiePreference`, `DeliveryMethod`, `DeliveryQuote`, `EmailVerificationCode`, `FaqArticle`, `FaqCategory`, `Feedback`, `FooterLink`, `FriendRequest`, `HasPublicUuid`, `IconAsset`, `LandingCard`, `LandingSection`, `LegalPage`, `LegalPageRevision`, `Listing`, `ListingCategory`, `ListingMedia`, `ListingPricingRule`, `Media`, `MediaTranscript`, `Message`, `MessageAttachment`, `MessageUserHide`, `ModerationAction`, `ModerationQueue`, `NotificationPreference`, `PendingEmailChange`, `PersonalDataConsent`, `PhoneVerificationCode`, `PostCategory`, `PostMedia`, `PostReaction`, `Referral`, `Report`, `RulePage`, `RulePageRevision`, `RulePageSection`, `ShipmentEvent`, `SystemSetting`, `Tag`, `UploadSession`, `User`, `UserBlock`, `UserDocumentRequisites`, `UserOAuthAccount`, `UserPayoutRequisites`, `UserProfile`, `UserTwoFactor`, `Video`, `VideoCategory`, `VideoReaction`, `WithdrawalRequest`

## Наблюдения

**Контур эскроу один.** Актуальный — `SafeDeal` + `EscrowTransaction`
(миграция 17.08); он и описан в `80-payments.md`. Прототип предыдущей итерации
`EscrowDeal` (миграция `2026_07_15_140000_create_escrow_deals.php`) не получил
ни роутов, ни контроллеров; модель и enum удалены, а таблица пока осталась.

Уронить её одной миграцией не вышло: на проде существует `escrow_operations`
с внешним ключом на `escrow_deals`, и ни одна миграция репозитория эту таблицу
не создаёт. Пока не пройден аудит схемы прода, слепой `drop ... cascade` только
повторил бы ту же ошибку, поэтому чистка вынесена в отдельную задачу.

**Комиссия 5% хранится в трёх местах:** `safe_deals.platform_fee_kopecks`
(факт по сделке), `config/billing.php` → `safe_deal.platform_fee_percent`
(ставка), и вычисляется в `SafeDealService`. Единого источника правды нет —
изменение ставки не влияет на уже созданные сделки, что правильно, но связь
между ними нигде не зафиксирована.

**Комментарии — плоские.** У `Comment` есть `CommentMedia` и `CommentReaction`,
но поля `parent_id` в fillable нет. Ветвление ответов на уровне модели не
выражено.

**Репоста как сущности не существует.** Модели `Repost` нет; чем реализован
репост — по модели данных не определить.

**Статистики пользователя как таблицы нет.** Есть `ListingViewDaily`
(агрегат по объявлениям) и `UserViewHistory` (история просмотров), но
`user_stats` отсутствует — цифры кабинета считаются на лету.
