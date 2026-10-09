<?php

namespace App\Services\Sms;

use RuntimeException;

/**
 * SMS не ушла. Причина — в `reason`, и ставит её тот, кто знает.
 *
 * Сообщение исключения остаётся техническим и идёт в журнал: там нужны имена
 * переменных и ответ шлюза. Человеку показывается текст из
 * `SmsFailureReason::message()` — см. решение Ж5 и разбор в самом перечислении.
 *
 * Умолчание — `GatewayRefused`, то есть «наша вина, причина неизвестна». Так
 * выбрано нарочно: если новый драйвер забудет назвать причину, человек
 * получит честное «не получается отправить», а не обвинение в неверном
 * номере.
 */
class SmsDeliveryException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly SmsFailureReason $reason = SmsFailureReason::GatewayRefused,
    ) {
        parent::__construct($message);
    }
}
