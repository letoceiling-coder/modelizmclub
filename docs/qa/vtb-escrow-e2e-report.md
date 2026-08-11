# VTB «Безопасная сделка» — E2E тест и движение средств

**Дата:** 2026-08-12  
**Окружение:** production API + VTB sandbox (`modelizmclub`)  
**Тест:** `VtbEscrowE2eFlowTest` — **OK** (19 assertions, VPS)  
**Скрипт:** `deploy/scripts/e2e-vtb-escrow-report.php`

---

## Сценарий

| # | Роль | Действие | API / механизм |
|---|------|----------|----------------|
| 1 | Продавец | Публикует товар | `POST /listings` → `published` |
| 2 | Покупатель | Смотрит расчёт комиссии | `GET /escrow/quote` |
| 3 | Покупатель | «Купить безопасно» | `POST /listings/{uuid}/escrow/checkout` → форма VTB |
| 4 | Покупатель | Оплачивает | VTB sandbox (форма / callback) |
| 5 | Система | Фиксирует оплату | `POST /payments/webhooks/vtb` или `POST /escrow/{uuid}/sync` |
| 6 | Продавец | Отправляет посылку | `POST /shipments/{id}/confirm` + webhook CDEK/Yandex |
| 7 | Система | Статус «В пути» → «Доставлено» | `EscrowShipmentSync` по webhook перевозчика |
| 8 | Покупатель | «Подтвердить получение» | `POST /escrow/{uuid}/confirm-receipt` |
| 9 | Система | Завершение сделки | `completed`, объявление → `sold`, ledger выплаты продавцу |

---

## Тестовые данные (прогон E2E)

| Параметр | Значение |
|----------|----------|
| Цена товара | **1 500,00 ₽** (150 000 коп.) |
| Доставка (покупатель) | **500,00 ₽** (50 000 коп.) |
| **Итого с покупателя** | **2 000,00 ₽** |
| Режим комиссии | `percent` (5%, min 300 ₽) |
| VTB режим | `single` (preAuth не включён на мерчанте) |

---

## Движение денежных средств

### Сводная таблица

| Этап | Покупатель | VTB (мерchant) | Площадка | Продавец | Перевозчик |
|------|------------|----------------|----------|----------|------------|
| Checkout | — | регистрация заказа | — | — | — |
| Оплата | **−2 000,00 ₽** | **+2 000,00 ₽** (single-stage capture) | — | — | — |
| После confirm | — | удержано на р/с мерчанта | **+300,00 ₽** (комиссия) | **+1 200,00 ₽** (к выплате) | **500,00 ₽** оплачены покупателем* |

\* Доставка включена в charge покупателя; перевод CDEK/Yandex — отдельный контур, не автоматизирован в escrow.

### Детализация комиссий и сборов

| Статья | Сумма | Основание |
|--------|-------|-----------|
| **Товар** | 1 500,00 ₽ | `item_amount_cents` |
| **Доставка** | 500,00 ₽ | `delivery_amount_cents` (не входит в базу комиссии) |
| **Комиссия площадки** | 300,00 ₽ | 5% от 1 500 ₽ = 75 ₽ → **min 300 ₽** (`escrow.fee.min_cents`) |
| **К выплате продавцу** | 1 200,00 ₽ | 1 500 − 300 = **1 200 ₽** |
| **Списано (captured)** | 2 000,00 ₽ | полная сумма заказа VTB |
| **Начислено продавцу (ledger)** | 1 200,00 ₽ | `paid_out_cents` после confirm |
| **Комиссия VTB эквайринга** | по тарифу банка | не возвращается в API; удерживает банк из поступления на р/с |

### Формула комиссии (текущие настройки)

```
base = item_cents                          # apply_to = item
fee  = max(round(base × 5%), 30000)       # min 300 ₽
fee  = min(fee, item_cents)
seller_payout = item_cents − fee
buyer_total   = item_cents + delivery_cents
```

---

## Поля сделки после завершения

| Поле | Значение |
|------|----------|
| `status` | `completed` |
| `amount_cents` | 200 000 |
| `item_amount_cents` | 150 000 |
| `delivery_amount_cents` | 50 000 |
| `platform_fee_cents` | 30 000 |
| `seller_payout_cents` | 120 000 |
| `captured_cents` | 200 000 |
| `paid_out_cents` | 120 000 |
| `listing.status` | `sold` |

---

## Результаты прогонов

### 1. Автотест (VPS, PostgreSQL test DB)

```bash
cd backend && php vendor/bin/phpunit tests/Feature/VtbEscrowE2eFlowTest.php
# OK (1 test, 19 assertions)
```

Покрывает: quote → checkout → webhook → shipment sync → confirm → ledger.

### 2. Production sandbox API

```bash
php deploy/scripts/e2e-vtb-escrow-report.php --item-cents=150000 --delivery-cents=50000
```

| Шаг | Статус |
|-----|--------|
| Создание продавца/покупателя/объявления | OK |
| Quote + checkout URL VTB | OK |
| `paymentorder.do` (авто-оплата тест-картой) | **Access denied** — на мерчанте запрещён direct API pay |
| Оплата через форму VTB | **Требуется вручную** |

**Pending deal для ручной оплаты:**

- Escrow: `912a89c0-34bf-401e-86ec-ebefd90507ea`
- Listing: `f661b756-57b1-4d15-9880-0998f2447a08`
- [Checkout URL](https://vtb.rbsuat.com/payment/merchants/ecom/payment.html?mdOrder=cc889fcf-408a-7ad8-9460-1d8a00e18665&language=ru)

После оплаты продолжить:

```bash
php deploy/scripts/e2e-vtb-escrow-report.php --escrow-uuid=912a89c0-34bf-401e-86ec-ebefd90507ea
```

---

## Ограничения / что не автоматизировано

1. **Банковский перевод продавцу** — ledger `paid_out_cents` выставляется при confirm; фактический перевод на карту/счёт — вручную (admin payout).
2. **Комиссия VTB** — не отображается в API, только в отчётах банка.
3. **PreAuth (холд)** — на мерчанте errorCode 5; используется одностадийная оплата (`VTB_ESCROW_MODE=auto`).
4. **Оплата без браузера** — `paymentorder.do` возвращает Access denied для `modelizmclub-api`.
5. **Таймауты** (`auto_release_days`, `seller_ship_deadline_days`) — в настройках есть, cron не реализован.

---

## Тестовые аккаунты E2E

| Роль | Email | Пароль |
|------|-------|--------|
| Продавец | `escrow-e2e-seller@modelizmclub.ru` | `password123` |
| Покупатель | `escrow-e2e-buyer@modelizmclub.ru` | `password123` |

Объявление: **E2E VTB Escrow — модель 1:48** (1 500 ₽).
