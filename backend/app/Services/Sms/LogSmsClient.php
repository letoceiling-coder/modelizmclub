<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

/**
 * Драйвер `log`: сообщение пишется в журнал и никуда не уходит.
 *
 * Был описан в `config/sms.php` как один из трёх драйверов, но класса не
 * имел: ветка `if ($driver === 'log')` лежала внутри каждого клиента и
 * повторялась дословно. Значит новый провайдер обязан был её скопировать,
 * иначе `SMS_DRIVER=log` начинал слать настоящие сообщения — молча и с
 * настоящими деньгами.
 *
 * Теперь это обычный драйвер, выбираемый так же, как остальные.
 */
class LogSmsClient implements SmsSender
{
    public function send(string $phone, string $text): array
    {
        Log::info('SMS (log driver)', ['phone' => $phone, 'text' => $text]);

        return ['status' => 'logged'];
    }
}
