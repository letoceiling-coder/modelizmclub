# План реализации доставки СДЭК + Яндекс Доставка

Дата: 2026-07-08  
Область: **только backend** (`backend/`). Frontend — позже, **только экраны доставки** (остальной UI не трогаем).  
Документация API: Scramble → `docs/openapi/openapi.json` после каждой фазы.

## Проверка ключей (2026-07-08)

| Провайдер | Статус |
|-----------|--------|
| **СДЭК** (`api.cdek.ru`) | ✅ OAuth 200, токен выдаётся |
| **Яндекс Доставка** (`b2b-authproxy.taxi.yandex.net`) | ✅ Список ПВЗ `geo_id=213` → HTTP 200 |

Секреты хранятся **только** в `backend/.env` на сервере и в `.env.example` — плейсхолдеры.

---

## Бизнес-модель (C2C маркетплейс)

Продавец и покупатель **сами выбирают точки** на карте/в списке:

```
Продавец                          Покупатель
   │                                   │
   ├─ Настраивает профиль доставки     ├─ В чате по объявлению оформляет отправление
   │  (склад/ПВЗ отправки по умолчанию)│
   │                                   ├─ Выбирает ПВЗ/склад получения
   └─ При сделке подтверждает          └─ Видит расчёт стоимости и трекинг
      отправку с выбранной точки А
      на выбранную точку Б
```

**СДЭК:** `shipment_point` / код ПВЗ отправки (продавец) → `delivery_point` / ПВЗ получения (покупатель).  
**Яндекс:** `platform_station_id` склада отправки (продавец) → `platform_station_id` ПВЗ получения (покупатель).

Оплата доставки: на первом этапе **«уже оплачено»** (`already_paid`) — стоимость согласуется в чате; позже — интеграция с биллингом.

---

## Архитектура модуля

```
Modules/Delivery/
├── Contracts/
│   ├── DeliveryProvider.php      # cdek | yandex
│   ├── CdekGateway.php           # (уже есть)
│   └── YandexGateway.php
├── Enums/
│   ├── DeliveryProvider.php
│   ├── ShipmentStatus.php
│   └── DeliveryPointType.php     # warehouse | pickup_point
├── Models/                       # Eloquent в app/Models/
├── Services/
│   ├── CdekService.php           # (уже есть)
│   ├── YandexDeliveryService.php
│   ├── DeliveryQuoteService.php
│   ├── ShipmentService.php
│   ├── ShipmentTrackingService.php
│   └── AdminDeliveryStatsService.php
├── Http/Controllers/Api/V1/
│   ├── Seller/                   # профиль точек продавца
│   ├── Shipments/              # сделки доставки
│   ├── PickupPoints/           # прокси ПВЗ + калькулятор
│   └── Webhooks/               # CDEK + Yandex
├── Http/Controllers/Api/V1/Admin/
│   ├── AdminDeliveryStatsController.php
│   └── AdminShipmentsController.php
├── Http/Resources/
├── Http/Requests/
└── routes/api.php
```

**Паттерн:** `DeliveryProvider` — единый интерфейс (`quote`, `createShipment`, `track`, `listPickupPoints`).  
Реализации: `CdekDeliveryProvider`, `YandexDeliveryProvider`.

---

## Схема БД

### 1. `seller_delivery_profiles` — точки отправки продавца

| Поле | Тип | Описание |
|------|-----|----------|
| id | bigint PK | |
| user_id | FK users | продавец |
| provider | enum cdek/yandex | |
| point_type | enum warehouse/pickup_point | тип точки отправки |
| external_point_id | string | код СДЭК / platform_station_id Яндекс |
| label | string | «ПВЗ на Ленина» |
| address | jsonb | полный адрес от API |
| city_id | FK nullable | связь с cities |
| is_default | bool | точка по умолчанию |
| is_active | bool | |
| meta | jsonb | сырой ответ провайдера |

Уникальность: `(user_id, provider, external_point_id)`.

### 2. `shipments` — отправление по сделке

| Поле | Тип | Описание |
|------|-----|----------|
| uuid | uuid | публичный ID |
| listing_id | FK | объявление |
| conversation_id | FK nullable | чат |
| seller_id | FK | |
| buyer_id | FK | |
| provider | enum | |
| status | enum | см. ниже |
| seller_point_id | FK seller_delivery_profiles nullable | откуда (snapshot) |
| source_point | jsonb | снимок точки А на момент создания |
| destination_point | jsonb | точка Б (ПВЗ покупателя) |
| weight_kg | decimal | |
| dimensions_cm | jsonb | {l,w,h} |
| delivery_cost_cents | int nullable | |
| currency | string | RUB |
| tracking_number | string nullable | трек для пользователя |
| external_id | string nullable | uuid заказа у провайдера |
| external_status | string nullable | |
| quoted_at | timestamp | |
| created_at_provider | timestamp | |
| delivered_at | timestamp nullable | |
| cancelled_at | timestamp nullable | |
| raw_payload | jsonb | последний ответ API |
| error_message | text nullable | |

**Статусы `ShipmentStatus`:**
`draft` → `quoted` → `awaiting_seller` → `creating` → `created` → `accepted` → `in_transit` → `at_pickup` → `delivered` | `cancelled` | `error`

### 3. `shipment_events` — история для трекинга и админки

| Поле | Тип |
|------|-----|
| shipment_id | FK |
| status | string |
| provider_status | string nullable |
| message | text nullable |
| occurred_at | timestamp |
| payload | jsonb nullable |

### 4. `delivery_quotes` — кэш расчётов (опционально, TTL 30 мин)

| Поле | Тип |
|------|-----|
| uuid | uuid |
| shipment_id | FK nullable |
| provider | enum |
| source_point | jsonb |
| destination_point | jsonb |
| parcels | jsonb |
| price_cents | int |
| tariff_code | string nullable |
| expires_at | timestamp |

---

## API — пользовательские endpoint'ы

Префикс: `/api/v1`, middleware `auth:sanctum`.

### A. Профиль доставки продавца

| Метод | Path | Описание |
|-------|------|----------|
| GET | `/users/me/delivery-profile` | все точки отправки продавца |
| POST | `/users/me/delivery-profile` | добавить точку (provider, point_type, external_point_id, label?) |
| PATCH | `/users/me/delivery-profile/{id}` | обновить / сделать default |
| DELETE | `/users/me/delivery-profile/{id}` | деактивировать |

### B. Справочники ПВЗ (прокси к провайдерам)

| Метод | Path | Query/body |
|-------|------|------------|
| GET | `/delivery/cdek/pickup-points` | `city_code`, `type`, `q` |
| GET | `/delivery/cdek/cities` | поиск города |
| POST | `/delivery/cdek/quote` | from_point, to_point, weight, dimensions |
| GET | `/delivery/yandex/pickup-points` | `geo_id` или lat/lon |
| GET | `/delivery/yandex/location/detect` | адрес → geo_id |
| POST | `/delivery/yandex/quote` | source_station_id, dest_station_id, places[] |

Токены провайдеров **никогда** не отдаются клиенту.

### C. Отправления (сделка)

| Метод | Path | Кто | Описание |
|-------|------|-----|----------|
| POST | `/shipments` | покупатель | создать draft: listing_uuid, conversation_uuid?, provider, destination_point, weight, dimensions |
| POST | `/shipments/{uuid}/quote` | покупатель | пересчитать стоимость |
| PATCH | `/shipments/{uuid}` | продавец/покупатель | обновить draft (точка отправки продавца) |
| POST | `/shipments/{uuid}/confirm` | продавец | подтвердить + создать заказ у провайдера |
| POST | `/shipments/{uuid}/cancel` | продавец/покупатель | отмена до handoff |
| GET | `/shipments/{uuid}` | участники | детали + events |
| GET | `/shipments` | участники | мои отправления (role=seller/buyer, status, provider) |
| GET | `/shipments/{uuid}/label` | продавец | PDF этикетки (если провайдер отдаёт) |

**Создание из чата:** `conversation_id` + `listing_id` уже есть в `conversations` — подтягиваем автоматически.

### D. Webhooks (без auth, с подписью)

| Метод | Path |
|-------|------|
| POST | `/webhooks/cdek/order-status` |
| POST | `/webhooks/yandex/delivery-status` |

Обновляют `shipments` + пишут `shipment_events` + опционально уведомление в чат (Phase 2).

---

## API — суперадмин (`role:admin`)

Группа Scramble: `Admin — Delivery`.

| Метод | Path | Описание |
|-------|------|----------|
| GET | `/admin/delivery/stats` | агрегаты для дашборда |
| GET | `/admin/delivery/shipments` | список с фильтрами |
| GET | `/admin/delivery/shipments/{uuid}` | детали + events + raw |
| GET | `/admin/delivery/shipments/export` | CSV за период |
| PATCH | `/admin/delivery/shipments/{uuid}` | ручная смена статуса / заметка (аудит) |

### Метрики `AdminDeliveryStatsService`

```json
{
  "shipments_total": 0,
  "shipments_by_provider": { "cdek": 0, "yandex": 0 },
  "shipments_by_status": { "created": 0, "in_transit": 0, "delivered": 0, "error": 0 },
  "delivery_revenue_cents": 0,
  "avg_delivery_days": null,
  "errors_last_7d": 0,
  "top_cities": []
}
```

Расширить `AdminDashboardService::stats()` полем `delivery` (или отдельный endpoint — предпочтительно отдельный, чтобы не ломать текущий дашборд).

---

## Интеграция провайдеров

### СДЭК (уже частично готово)

- SDK: `antistress-store/cdek-sdk-v2`
- `CdekService` + `CdekApiExtension`
- Создание заказа: `createOrder()` — тариф склад–склад / склад–ПВЗ
- ПВЗ: `getDeliveryPoints()`
- Калькулятор: `calculateTariffList()`
- Webhook: `ORDER_STATUS` → маппинг в `ShipmentStatus`
- Печать: `setBarcode()` / `getBarcodePdf()`

### Яндекс Доставка

- HTTP-клиент `YandexDeliveryService` (Guzzle)
- Base URL: `https://b2b-authproxy.taxi.yandex.net`
- Auth: `Authorization: Bearer {YANDEX_DELIVERY_TOKEN}`
- Методы:
  - `POST /api/b2b/platform/pickup-points/list`
  - `POST /api/b2b/platform/pricing-calculator`
  - `POST /api/b2b/platform/offers/create` (или актуальный create order из [документации](https://yandex.ru/support/delivery-profile/))
  - `GET /api/b2b/platform/request/info` — статус
- Webhook от Яндекс — зарегистрировать URL в ЛК

**Важно:** у продавца свой `platform_station_id` склада/ПВЗ отправки регистрируется через выбор из `pickup-points/list` (`available_for_dropoff: true`).

---

## Конфигурация `.env`

```env
CDEK_ENABLED=true
CDEK_TEST=false
CDEK_ACCOUNT=
CDEK_SECURE=
CDEK_TIMEOUT=10

YANDEX_DELIVERY_ENABLED=true
YANDEX_DELIVERY_TOKEN=
YANDEX_DELIVERY_API_URL=https://b2b-authproxy.taxi.yandex.net
YANDEX_DELIVERY_TIMEOUT=15
```

Файлы: `config/cdek.php` (есть), `config/yandex-delivery.php` (создать).

---

## Фазы реализации

### Фаза 0 — подготовка (1–2 дня)

- [ ] Миграции: `seller_delivery_profiles`, `shipments`, `shipment_events`, `delivery_quotes`
- [ ] Enums, Models, factories
- [ ] `config/yandex-delivery.php`, обновить `.env.example`
- [ ] Ключи на сервере (`/var/www/modelizmclub/backend/.env`)
- [ ] `YandexGateway` + базовые HTTP-методы
- [ ] Подключить `Delivery/routes/api.php` в `routes/api.php`
- [ ] `php artisan scramble:export`

### Фаза 1 — справочники и профиль продавца (2–3 дня)

- [ ] CRUD `seller_delivery_profiles`
- [ ] Прокси ПВЗ СДЭК + Яндекс
- [ ] Калькулятор quote (оба провайдера)
- [ ] Feature-тесты с `Http::fake()`
- [ ] Swagger

### Фаза 2 — жизненный цикл shipment (3–4 дня)

- [ ] `ShipmentService`: draft → quote → confirm → create у провайдера
- [ ] Список/детали для seller/buyer
- [ ] `ShipmentTrackingService`: polling fallback (cron `delivery:sync-statuses`)
- [ ] Webhooks CDEK + Яндекс
- [ ] Feature-тесты полного flow
- [ ] Swagger

### Фаза 3 — админка (2 дня)

- [ ] `AdminDeliveryStatsController`
- [ ] `AdminShipmentsController` (index, show, export)
- [ ] Аудит-лог при ручных правках админа
- [ ] Расширить OpenAPI группой `Admin — Delivery`
- [ ] Feature-тесты admin

### Фаза 4 — frontend доставки (вне текущего scope)

Только новые экраны/компоненты (не трогать остальной UI):

- Настройки продавца: выбор склада/ПВЗ отправки
- В чате: оформление доставки, выбор ПВЗ получения, трекинг
- Виджет Яндекс ПВЗ (опционально) — через backend-прокси

---

## Пользовательские сценарии (для frontend, контракт готов в Фазе 2)

### Продавец

1. Профиль → «Доставка» → добавить точку отправки (СДЭК или Яндекс).
2. В объявлении уже отмечены `delivery_methods` — фильтр провайдера.
3. В чате видит запрос покупателя → подтверждает отправку.
4. Получает этикетку/трек, отслеживает статус.

### Покупатель

1. В чате по объявлению → «Оформить доставку».
2. Выбирает провайдера (из `delivery_methods` объявления).
3. Указывает габариты/вес, выбирает ПВЗ получения.
4. Видит цену → подтверждает → ждёт отправки продавцом.
5. Трекинг в карточке отправления.

### Суперадмин

1. `/admin` → блок «Доставка»: KPI + график по статусам.
2. Таблица отправлений: фильтр по провайдеру, статусу, дате, ошибкам.
3. Экспорт CSV для бухгалтерии/разбора инцидентов.

---

## Тестирование

| Уровень | Что |
|---------|-----|
| Unit | маппинг статусов CDEK/Яндекс → `ShipmentStatus` |
| Feature | CRUD профиля, quote, create shipment, webhooks, admin stats |
| Server | `php artisan test --filter=Delivery` на VPS после деплоя |

Моки: `Http::fake()` для Яндекс; `CdekClientV2::setHttp()` для СДЭК.

---

## Деплой и Swagger

После каждой фазы:

```bash
bash deploy/scripts/deploy-dev.sh
cd backend && php artisan scramble:export
# openapi.json попадает в docs/openapi/ при deploy-dev.sh
```

Ручная регистрация webhook в ЛК СДЭК/Яндекс:
- `https://modelizmclub.ru/api/v1/webhooks/cdek/order-status`
- `https://modelizmclub.ru/api/v1/webhooks/yandex/delivery-status`

---

## Риски и решения

| Риск | Решение |
|------|---------|
| Продавец не настроил точку отправки | Блокировать `confirm` с 422 и текстом «Укажите склад отправки» |
| Разные модели C2C у провайдеров | Адаптер `DeliveryProvider`, snapshot точек в `shipments` |
| Webhook не пришёл | Cron `delivery:sync-statuses` каждые 15 мин |
| Секреты в git | Только `.env` на сервере, `.env.example` с пустыми значениями |
| Аккумуляторы LiPo | Валидация категории объявления — предупреждение в quote response |

---

## Чеклист готовности к продакшену

- [ ] Ключи СДЭК/Яндекс в server `.env`, `CDEK_TEST=false`
- [ ] Webhooks зарегистрированы и проходят smoke-тест
- [ ] Все Feature-тесты зелёные на CI/VPS
- [ ] `docs/openapi/openapi.json` обновлён
- [ ] Админ-статистика отдаёт реальные данные
- [ ] Frontend доставки подключён к API (отдельная задача)
