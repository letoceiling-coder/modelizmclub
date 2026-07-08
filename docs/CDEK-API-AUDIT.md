# Аудит CDEK API v2: пакет vs документация

Дата: 2026-07-06  
Документация: [apidoc.cdek.ru](https://apidoc.cdek.ru/)  
Пакет: [antistress-store/cdek-sdk-v2](https://github.com/AntistressStore/cdek-sdk-v2) **v1.6** (релиз 2026-04-07)

## Вывод

**Свой SDK с нуля не требуется.** Пакет покрывает основные сценарии доставки для маркетплейса и активно поддерживается (mock-тесты, `setHttp()` для подмены клиента).

В проекте используется **гибрид**:

| Слой | Назначение |
|------|------------|
| `antistress-store/cdek-sdk-v2` | Калькулятор, ПВЗ, города/регионы, заказы (CRUD), печать, курьер, webhooks, НП, чеки |
| `Modules\Delivery\Services\CdekApiExtension` | Методы, отсутствующие в SDK v1.6 |
| `Modules\Delivery\Services\CdekService` | Единая точка входа (`CdekGateway`) |

## Покрытие API (официальные endpoint → SDK)

| Endpoint | Метод SDK | Статус |
|----------|-----------|--------|
| `POST /oauth/token` | внутренний | OK |
| `GET /deliverypoints` | `getDeliveryPoints()` | OK |
| `GET /location/cities` | `getCities()` | OK |
| `GET /location/regions` | `getRegions()` | OK |
| `POST /calculator/tariff` | `calculateTariff()` | OK |
| `POST /calculator/tarifflist` | `calculateTariffList()` | OK |
| `GET /calculator/alltariffs` | `getAvailableTariffs()` | OK |
| `POST /orders` | `createOrder()` | OK |
| `GET /orders/{uuid}` | `getOrderInfoByUuid()` | OK |
| `GET /orders?cdek_number=` | `getOrderInfoByCdekNumber()` | OK |
| `GET /orders?im_number=` | `getOrderInfoByImNumber()` | OK |
| `PATCH /orders` | `updateOrder()` | OK (uuid в теле) |
| `DELETE /orders/{uuid}` | `deleteOrder()` | OK |
| `POST /orders/{uuid}/refusal` | `cancelOrder()` | OK |
| `POST /print/barcodes` | `setBarcode()` | OK |
| `GET /print/barcodes/{uuid}` | `getBarcode()`, `getBarcodePdf()` | OK |
| `POST /print/orders` | `setInvoice()` | OK |
| `GET /print/orders/{uuid}` | `getInvoice()`, `getInvoicePdf()` | OK |
| `POST /delivery` | `createAgreement()` | OK |
| `GET /delivery/{uuid}` | `getAgreement()` | OK |
| `POST /intakes` | `createIntakes()` | OK |
| `GET /intakes/{uuid}` | `getIntakes()` | OK |
| `DELETE /intakes/{uuid}` | `deleteIntakes()` | OK |
| `GET /payment` | `getPayments()` | OK |
| `GET /check` | `getChecks()` | OK |
| `GET /registries` | `getRegistries()` | OK |
| `GET/POST/DELETE /webhooks` | `getWebhooks()`, `setWebhooks()`, … | OK |

## Пробелы SDK → наше расширение

| Endpoint | Почему нужен | Реализация |
|----------|--------------|------------|
| `GET /orders` (список с фильтрами) | Админка, синхронизация статусов | `CdekApiExtension::listOrders()` |
| `GET /intakes` (список заявок) | Учёт вызовов курьера | `CdekApiExtension::listIntakes()` |
| `POST /prealert` | Передача партии заказов в ПВЗ | `CdekApiExtension::createPrealert()` |
| `GET /prealert/{uuid}` | Статус преалерта | `CdekApiExtension::getPrealert()` |

В README SDK помечены как «в разработке»: преалерт и паспортные данные. Паспортные поля получателя доступны через сущность `Order` SDK (поля recipient), отдельного endpoint не требуется.

## Замечания по качеству SDK

1. **`deleteIntakes()` / `deleteOrder()`** — при успехе иногда возвращают `false` (особенность реализации, не API).
2. **`updateOrder()`** — `PATCH /orders` без uuid в path (соответствует протоколу СДЭК).
3. Пакет **актуален**: v1.6, тесты на mock, PHP 8.3 совместим.

## Конфигурация в проекте

```env
CDEK_ENABLED=false
CDEK_TEST=true
CDEK_ACCOUNT=
CDEK_SECURE=
```

Файл: `backend/config/cdek.php`

## Использование

```php
use Modules\Delivery\Contracts\CdekGateway;

public function __construct(private CdekGateway $cdek) {}

// SDK-методы
$points = $this->cdek->sdk()->getDeliveryPoints($filter);
$tariff = $this->cdek->sdk()->calculateTariffList($tariffEntity);

// Расширения
$orders = $this->cdek->listOrders(['date' => '2026-07-06']);
$prealert = $this->cdek->createPrealert([
    'planned_date' => '2026-07-10',
    'shipment_point' => 'MSK1',
    'orders' => [['order_uuid' => '...']],
]);
```

## Следующие шаги (интеграция в UI)

1. Публичные API: расчёт доставки, список ПВЗ по городу.
2. Создание CDEK-заказа при оформлении сделки в чате.
3. Webhook `ORDER_STATUS` для обновления статуса отправления.
