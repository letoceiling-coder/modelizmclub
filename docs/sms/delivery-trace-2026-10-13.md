# Трассировка SMS 13.10.2026 (+79892473472)

## Деплой modelizmclub.ru

- Фронт: `modelizmclub.ru` → Nitro `:3000`, API `location ^~ /api/` → `/var/www/modelizmclub/backend/public`.
- `api.modelizmclub.ru` → тот же `backend/public`.
- Git на сервере: `870e8a3a`, шаблон `Modelizm: код подтверждения %s…`, `SMS_DRIVER=iqsms`.

Запрос «Отправить SMS» с сайта и с API идёт в один бэкенд.

## Что уходит из приложения (23:21:25 MSK)

```
Phone verification SMS payload
  phone: +79892473472
  code_len: 6
  text: Modelizm: код подтверждения 966018. Никому не сообщайте код.
```

Сразу после: `SMS sent via iqsms`, `smsc_id=6902639333`, подпись `(default)`.

**Логика кода на сервере корректна:** шесть цифр, тот же код в `phone_verification_codes`.

## Что отвечает iqSMS (status.json)

Для `6902639333`, `6902639217`, `6902638129`, `6902637771`, `6902637546` и др.:

```json
"status": "delivery error"
```

То есть шлюз **принял** SMS, но **оператор не доставил** наш текст на handset.

## Что видит человек

«9764 — ваш код для доступа к серvисu…» (4 цифры, без Modelizm) — **не** строка из лога выше.

Это типовой текст **мобильной авторизации МТС** (отдельный канал), не ответ `PhoneVerificationService`.

Совпадения с нашим `966018` или `smsc_id` нет — это другая SMS.

## Почему «от МТС»

1. **22:35–22:38** в логе есть `SMS sent via MTS Marketolog` — тогда в `.env` кратко стоял `SMS_DRIVER=mts` (сейчас снова `iqsms`). Это API «МТС Маркетолог», отправитель `MODELIZM`, текст из `SmsTemplate` (6 цифр).
2. **Сообщение «9764… доступ к сервису»** — не Marketolog и не iqSMS из лога 23:21; при `delivery error` наша SMS часто **не приходит**, а операторская 4-значная может прийти от других сервисов/канала SIM.

## Действия

- Скрипт статуса: `bash deploy/scripts/iqsms-message-status.sh <smscId>`.
- Тикет в СМС Дисконт (8 800 700-99-10): `delivery error`, smscId, точный текст шаблона Modelizm, номер, согласованная подпись в ЛК.
- После выкатки: при `delivery error` API откажет в отправке (не «код отправлен»), в логе — полный `text` и `iqsms delivery status`.
