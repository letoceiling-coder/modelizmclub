# Денежная модель безопасной сделки на 04.10.2026

Снято чтением кода и схемы ночной тестовой базы. Прогон бэкенда зелёный
(см. `BASELINE.md`), `EscrowCommissionOnBuyerTest` — 10 проверок,
72 утверждения.

**Вывод промпта 04: чинить нечего.** Все двенадцать сценариев FIN-01…FIN-12
закрыты до ночи. По правилу 2.2 NIGHT-RUN («прежде чем чинить, воспроизведи
дефект; не воспроизвёлся — не трогаем») промпт получает `SKIPPED`.

---

## Поля

Денежные суммы — целые, в копейках. Чисел с плавающей точкой в суммах нет.
Соответствие требуемым Playbook именам:

| Playbook | В проекте | Тип в базе |
| :-- | :-- | :-- |
| `item_amount` | `item_kopecks` | `bigint`, not null |
| `buyer_fee_amount` | `platform_fee_kopecks` | `bigint`, not null, по умолчанию 0 |
| `delivery_amount` | `delivery_cost_kopecks` | `integer`, not null, по умолчанию 0 |
| `buyer_total_amount` | `amount_kopecks` | `bigint`, not null |
| `seller_payable_amount` | `seller_payout_kopecks` | `bigint`, not null |
| `currency` | `currency` | `varchar(3)`, по умолчанию `RUB` |
| `pricing_version` + `fee_rule_snapshot` | `fee_payer` | `varchar(12)`, по умолчанию `seller` |

Про последнюю строку отдельно. Playbook просит версию правил и снимок
ставки двумя полями; в проекте роль обеих играет одна колонка `fee_payer`
со значениями `seller` (прежняя схема) и `buyer` (новая). Почему так, а не
по дате и не по пустоте новых полей, объяснено в
`App\Enums\SafeDealFeePayer`. Смысл однозначен, что Playbook и допускает
(«имена могут отличаться»). Ставка при этом не «снимается» в строку: она
берётся из настройки на момент создания и сразу раскладывается на пять
величин, то есть снимком служат сами суммы.

## Контрольный пример

Проверен `EscrowCommissionOnBuyerTest::test_арифметика_на_трёх_суммах` на
трёх суммах — 500, 1 000 и 5 000 ₽ — каждая величина отдельным
утверждением, а не через одну сумму:

```
Товар                1 000 ₽     item_kopecks          = 100 000
Комиссия 5%             50 ₽     platform_fee_kopecks  =   5 000
Доставка                 D ₽     delivery_cost_kopecks =       D
Покупатель платит    1 050 ₽ + D amount_kopecks        = 105 000 + D
Продавец получает    1 000 ₽     seller_payout_kopecks = 100 000
```

Инвариант `amount = item + fee + delivery` и `payout = item` закреплён
отдельной проверкой `test_инвариант_новой_схемы`.

Комиссия берётся **с товара, а не с итога**: прод отдаёт
`safe_deal.base: "item"` в `/api/v1/public/tariffs`. Приёмка 27.09
подтвердила это на четырёх завершённых сделках, включая случай с
доставкой.

## FIN-01…FIN-12

| ID | Проверка | Статус | Чем доказано |
| :-- | :-- | :-- | :-- |
| FIN-01 | Новый товар 1000 ₽: комиссия 50, продавцу 1000 | **PASS** | `EscrowCommissionOnBuyerTest::test_арифметика_на_трёх_суммах`, `test_завершение_платит_продавцу_полную_цену` |
| FIN-02 | Дробные суммы, округление | **PASS** | суммы в копейках целыми; `DeliveryQuoteRoundingTest`, `Unit/DeliveryQuoteRoundingTest` |
| FIN-03 | Подмена суммы на клиенте | **PASS** | `SafeDealFeeTest`; чекаут берёт `quote.platform_fee_kopecks` с сервера, сервер пересчитывает сам |
| FIN-04 | Цена объявления изменилась после оформления | **PASS** | суммы записаны в строку сделки при создании, пересчёт из объявления не делается; `SafeDealListingLifecycleTest` |
| FIN-05 | Старая сделка не пересчитывается | **PASS** | `fee_payer = seller` на прежних сделках, обе схемы живут рядом; `EscrowCommissionOnBuyerTest` |
| FIN-06 | Повторный обратный вызов | **PASS** | `PaymentIdempotencyTest`, `ReconcilePendingPaymentsTest` |
| FIN-07 | Два одновременных подтверждения выплаты | **PASS** | `SafeDealRaceTest`, `SafeDealSettlementAtomicityTest` |
| FIN-08 | Ошибка после запроса провайдеру | **PASS** | `LostRequestsTest`, `RecoverFailureReasonsTest`, `PaymentFailureDiagnosticsTest`, `StalePaymentsAreSeenTest` |
| FIN-09 | Частичный возврат (деление спора) | **PASS** | `DisputeSplitWritesFactTest`; делится стоимость товара, комиссия возвращается покупателю |
| FIN-10 | Выгрузка и бухгалтерия | **PASS** | `DealExportShowsFactTest`, `LedgerCommissionOnlyRetainedTest`, `AdminLedgerTotalsTest`, `SafeDealEmailBreakdownTest` — «1000 → 50 → продавцу 1000», не «1000 → 50 → 950» |
| FIN-11 | Рубли, баллы, кредиты не смешиваются | **PASS** | `BonusPointsAreNotMoneyTest`, `PointsPayForListingsTest`, `PersonalPlacementQuotaTest` |
| FIN-12 | Повторное административное начисление | **PASS** | `PaymentIdempotencyTest`, `AdminSubscriptionGrantTest`, `AdminAuditCoverageTest` |

## Что в этой таблице не проверено банком

Ни один сценарий **не проходил через банк**. Контур ночью — заглушка:
`check-live-money.sh --root=…` отвечает кодом 1, провайдер `stub`,
адреса ВТБ не заданы. Это ожидаемый `BLOCKED` по решению R6.

Поэтому к каждой строке применима пометка **«не банк»**: проверена
арифметика, учёт, идемпотентность и выгрузки — то есть всё, что
принадлежит нам. Что ответит ВТБ на боевых ключах, из этих проверок
не следует, и один успешный платёж из 59 за всю жизнь сервиса
(`docs/BIBLE.md` VII.2) напоминает, почему это важно разделять.

Выплат продавцам за всю жизнь сервиса — ноль. Код выплат есть и покрыт
(`VtbA2cPayoutClientTest`, `VtbSbpPayoutClientTest`), контура нет.

## Ставка комиссии

| Где | Значение |
| :-- | :-- |
| Настройка по умолчанию | `SAFE_DEAL_PLATFORM_FEE_PERCENT`, 5 |
| Настройка в админке | `escrow.fee.percent`, раздел `monetizationPricing` |
| Публичный ответ прода | `safe_deal.percent: 5`, `base: "item"`, `min_cents: 0`, `max_cents: null` |

Ставка настраивается из админки, и это сохранено — ночью её никто не
менял. Тип ставки в `config/billing.php` — `(float)`, и это допустимо:
плавающая точка запрещена для **сумм**, а не для процента, из которого
сумма считается целыми копейками.
