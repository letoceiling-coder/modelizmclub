# 80 — Платёжный контур

Срез `origin/master` @ `ecb4d60`, значения `.env` — с прода на 03.09.2026.

## Два независимых пути к банку

Это главный факт раздела: **подписки и безопасная сделка ходят в банк разными
дорогами**, и переключатель у них разный.

```
Подписки / кошелёк / размещение / буст
  └─ PaymentGatewayManager::resolve()          ← config('billing.provider')
       ├─ 'stub' → StubPaymentGateway          ← ТЕКУЩЕЕ значение
       └─ 'vtb'  → VtbPaymentGateway

Безопасная сделка
  └─ SafeDealSettlementService                 ← config('billing.safe_deal.*')
       └─ VtbAcquiringClient                   ← напрямую, мимо Manager
```

`BILLING_PROVIDER=stub` на безопасную сделку **не влияет вообще**.

### Подписки — через `PaymentGatewayManager`

`backend/app/Modules/Billing/Services/PaymentGatewayManager.php:43`

```php
$mode = config('billing.provider', 'auto');
return match ($mode) {
    'stub' => $this->stub,                                   // текущее
    'vtb'  => $this->vtb->isConfigured() ? $this->vtb : $this->stub,
    default => $this->vtb->isConfigured() ? $this->vtb : $this->stub,
};
```

При `stub` возвращается заглушка **безусловно**, без проверки конфигурации ВТБ.
`StubPaymentGateway` помечает платёж `test_acquiring: true` и ведёт на
внутреннюю страницу `/pay/stub/{uuid}` с выбором исхода. Реальных списаний нет.

ЮKassa в `PaymentGatewayManager` отсутствует как вариант — `match` умеет
вернуть только `vtb` или `stub`. `config/billing.php` прямо пишет: «No longer
used for acquiring or escrow (spec v4.0). Retained solely for the payout
card-binding subsystem». Ветка `'yookassa'` в `CardBindingService::start()`
недостижима, поскольку `resolve()->provider()` её никогда не вернёт.

### Безопасная сделка — через `SafeDealSettlementService`

`backend/app/Modules/Billing/Services/SafeDealSettlementService.php:38`

```php
$mode = (string) config('billing.safe_deal.escrow_provider', 'auto');
return match ($mode) {
    self::PROVIDER_WALLET => self::PROVIDER_WALLET,
    self::PROVIDER_VTB    => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
    default               => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
};
```

`vtbConfigured()` (строка 196) = `billing.vtb.enabled` И (`token` ИЛИ
`username`+`password`). На проде это true, поэтому провайдер — `vtb`,
и запросы уходят в `VtbAcquiringClient`.

## Контур банка — тестовый

| Переменная | Значение на проде | Что это |
|---|---|---|
| `VTB_ACQUIRING_API_URL` | `https://vtb.rbsuat.com/payment/rest` | **sandbox** |
| `VTB_PAYOUT_OAUTH_URL` | `https://epa-ift-sbp.vtb.ru/passport/oauth2/token` | sandbox |
| `VTB_PAYOUT_API_URL` | `https://test3.api.vtb.ru:8443/openapi/smb/efcp` | тест |

Боевые адреса по комментариям в `config/billing.php`:
`https://platezh.vtb24.ru/payment/rest/` для эквайринга,
`https://open.api.vtb.ru/passport/oauth2/token` для выплат.

`VTB_ESCROW_MODE=auto` — **переменной с таким именем в коде нет ни одного
вхождения**. Режим захвата задаёт `SAFE_DEAL_VTB_CAPTURE_MODE`.

## Двухстадийный путь реализован полностью

Это не заготовка. `VtbAcquiringClient` содержит все четыре операции:

| Метод | Строка | Эндпоинт RBS |
|---|---|---|
| `registerOrder` | 24 | `register.do` |
| `registerPreAuth` | 35 | `registerPreAuth.do` |
| `deposit` | 45 | `deposit.do` |
| `reverse` | 61 | `reverse.do` |
| `refund` | 71 | `refund.do` |

`SafeDealSettlementService` их использует:

```php
// строка 100-101
$endpoint = $twoStage ? 'registerPreAuth.do' : 'register.do';
$register = $twoStage ? $this->client->registerPreAuth($params)
                      : $this->client->registerOrder($params);
// 157: $this->client->deposit(...)
// 178: $this->client->refund(...)      ← one_stage
// 181: $this->client->reverse(...)     ← two_stage
```

Выбор делает `captureMode()` (строка 55) из
`config('billing.safe_deal.vtb_capture_mode')`. На проде `one_stage`,
`holdsOnCard()` = false: деньги списываются сразу через `register.do`,
отмена — через `refund`, а не `reverse`.

**Тесты, покрывающие путь:**

- `backend/tests/Unit/VtbAcquiringClientTest.php` — в прогоне виден тест
  `register pre auth deposit and reverse`;
- `backend/tests/Feature/SafeDealVtbHoldTest.php`;
- `backend/tests/Feature/SafeDealVtbSettlementModelsTest.php`;
- `backend/tests/Feature/SafeDealCdekCheckoutTest.php`;
- `backend/tests/Unit/VtbA2cPayoutClientTest.php`, `VtbSbpPayoutClientTest.php`.

## Колбэки

Восемь webhook-маршрутов, **все без middleware** (кроме группы `api`):

| Метод | URI | Контроллер |
|---|---|---|
| GET/POST | `/api/v1/payments/webhooks/vtb` | `VtbWebhookController` |
| GET/POST | `/api/v1/safe-deals/webhooks/vtb` | `SafeDealVtbWebhookController` |
| POST | `/api/v1/safe-deals/webhooks/vtb-payout` | `SafeDealPayoutWebhookController` |
| POST | `/api/v1/safe-deals/webhooks/delivery` | `SafeDealDeliveryWebhookController` |
| POST | `/api/v1/webhooks/cdek/order-status` | `CdekOrderStatusWebhookController` |
| POST | `/api/v1/webhooks/yandex/delivery-status` | `YandexDeliveryStatusWebhookController` |
| POST | `/api/v1/webhooks/max` | `MaxWebhookController` |

`SafeDealVtbWebhookController` целиком (34 строки):

```php
$orderId = (string) ($request->input('mdOrder') ?? $request->input('orderId') ?? '');
if ($orderId === '') {
    Log::warning('SafeDeal VTB webhook without order id', $request->all());
    return response()->json(['status' => 'ignored']);
}
$sync->syncByRbsOrderId($orderId);
return response()->json(['status' => 'ok']);
```

Проектное решение зафиксировано в докблоке: «The callback carries no
trustworthy state, so we only take the order id from it and ask VTB for the
authoritative status — a forged call can at worst make us re-read a status we
already have».

То есть **подпись колбэка не проверяется намеренно**: из тела берётся только
идентификатор заказа, а состояние перечитывается у банка через
`SafeDealHoldSyncService::syncByRbsOrderId()`. Идемпотентность обеспечивается
тем же способом — повторный вызов просто повторно синхронизирует статус.

Отдельно существует `VtbCallbackChecksumValidator`
(`backend/app/Support/`, тест `tests/Unit/VtbCallbackChecksumValidatorTest.php`)
— проверка контрольной суммы колбэка, добавленная коммитом `8ed8d55`.
Используется ли она в `SafeDealVtbWebhookController` — нет: контроллер её не
вызывает.

## Где пишется `rbs_order_status`

Единственное место — `backend/app/Models/SafeDealIncomingPayment.php:91`:

```php
$this->rbs_order_status = $orderStatus;
```

Поле объявлено в `$fillable` (строка 34) и приводится к `integer` (строка 54).
Значение приходит из ответа банка на `getOrderStatusExtended`, который
вызывает `SafeDealHoldSyncService`.

## Состояние данных на 03.09.2026

Из дампа прод-базы:

| Провайдер / статус | Записей |
|---|---:|
| `stub` / paid | 30 |
| `yookassa` / pending | 27 |
| `vtb` / pending | 10 |
| `wallet` / paid | 4 |
| `stub` / pending | 6 |
| `stub` / failed | 2 |

**Ни одного успешного платежа через `vtb` или `yookassa`.** Все четыре записи
`safe_deal_incoming_payments` — `status=pending`, `capture_mode=one_stage`,
`rbs_order_status=NULL`, `checkout_url` ведёт на `vtb.rbsuat.com`.

Суммы созданных сделок: 1101 ₽, 1201 ₽, 2900 ₽, 11 900 ₽.

## Комиссия 5%

Задаётся `SAFE_DEAL_PLATFORM_FEE_PERCENT` (по умолчанию 5) в
`config/billing.php` → `safe_deal.platform_fee_percent`, фиксируется по сделке
в `safe_deals.platform_fee_kopecks`, вычисляется в `SafeDealService`
(1137 строк — самый большой файл бэкенда).
