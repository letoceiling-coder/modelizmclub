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

На скриншотах видно, что форма требует заполнить все обязательные поля (иначе красные ошибки «Тип callback уведомления не указан», «URL не может быть пустым», «Не выбрано ни одной callback операции»).

| Поле | Значение |
|------|----------|
| Callback уведомления | **Включены** |
| Тип | **Статический** |
| Метод | **POST** |
| URL | `https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb` |
| Тип подписи | **Симметричный** → нажать **Сгенерировать** |
| Операции | ✅ Успешный холд · ✅ Успешное списание · ✅ Отмены · ✅ Возврат |

После генерации токена:

1. Скопировать callback token в `.env` на сервере: `VTB_CALLBACK_TOKEN=<токен>`
2. Выполнить `php artisan config:cache` в `/var/www/modelizmclub/backend`
3. Сохранить настройки в портале ВТБ

Backend проверяет HMAC-SHA256 checksum (параметр `checksum`) когда `VTB_CALLBACK_TOKEN` задан. Без токена webhook принимает запросы без checksum (только для отладки).

Проверка доступности (до настройки checksum в портале):

```bash
curl -sS "https://api.modelizmclub.ru/api/v1/payments/webhooks/vtb?mdOrder=test"
# → {"status":"ok"}
```

После включения симметричной подписи без checksum:

```bash
# → {"status":"invalid_checksum"}  HTTP 400
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
