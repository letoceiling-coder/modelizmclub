# VTB Sandbox — callback и тестовая оплата

## Credentials (sandbox)

| Параметр | Значение |
|----------|----------|
| Portal | https://vtb.rbsuat.com/mportal3/ |
| API REST | https://vtb.rbsuat.com/payment/rest/ |
| Merchant | modelizmclub |
| API user | modelizmclub-api |
| Operator | modelizmclub-operator |
| REST auth | userName + password (API user) |

## Backend `.env` (production VPS)

```env
BILLING_PROVIDER=vtb
VTB_ACQUIRING_ENABLED=true
VTB_ACQUIRING_API_URL=https://vtb.rbsuat.com/payment/rest
VTB_ACQUIRING_USERNAME=modelizmclub-api
VTB_ACQUIRING_PASSWORD=***
VTB_ESCROW_MODE=auto
VTB_CALLBACK_TOKEN=***
```

`VTB_ESCROW_MODE=auto` — пробует `registerPreAuth.do`; если у мерчанта не включена предавторизация (ошибка 5), автоматически использует одностадийный `register.do` для sandbox-тестов.

После включения preAuth в кабинете ВТБ переключите на `VTB_ESCROW_MODE=preauth`.

## Callback в личном кабинете ВТБ

**Настройки → Мерчант → Callback уведомления**

1. Включить «Callback уведомления»
2. Тип: **Статический** (дополнительно per-order передаётся `dynamicCallbackUrl`)
3. Метод: **POST**
4. URL:

   `https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb`

5. Тип подписи: **Симметричный** → «Сгенерировать» callback token → сохранить в `VTB_CALLBACK_TOKEN`
6. Операции (отметить):
   - Успешный холд
   - Успешное списание
   - Отмены
   - Возврат

7. Сохранить

Проверка доступности:

```bash
curl -sS "https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb?mdOrder=test"
```

## PreAuth на мерчанте

Если `registerPreAuth.do` возвращает `errorCode: 5` («Платежи с предавторизацией не разрешены»):

- **Настройки → Мерчант → Основные настройки** — включить двухстадийные платежи (обратиться в поддержку ВТБ, если опции нет)
- До включения работает fallback `VTB_ESCROW_MODE=auto` (одностадийная оплата + ledger)

## Smoke на сервере

```bash
bash /var/www/modelizmclub/deploy/scripts/smoke-vtb-escrow.sh
php /var/www/modelizmclub/deploy/scripts/test-vtb-register.php
```

## Тестовая карта (sandbox)

См. https://vtb.rbsuat.com/sandbox/ — раздел тестовых карт.

## Включение на сайте

1. Админка → **Настройки** → включить «Безопасная сделка»
2. Покупатель на объявлении → **Купить безопасно** → оплата на форме ВТБ
3. После оплаты — «Проверить оплату» / callback → статус «Ждёт отправки»
4. Покупатель → «Подтвердить получение» → выплата продавцу (ручная через admin до bank API)
