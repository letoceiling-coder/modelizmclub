<?php

namespace App\Services\Sms;

use App\Support\PhoneNormalizer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMS-дисконт — https://smsdiscount.ru, HTTP API.
 *
 * Договор заключён, доступы будут позже. Клиент написан заранее, чтобы
 * подключение свелось к четырём значениям в `.env` и смене `SMS_DRIVER`:
 *
 *     SMS_DRIVER=smsdiscount
 *     SMSDISCOUNT_LOGIN=…
 *     SMSDISCOUNT_PASSWORD=…
 *     SMSDISCOUNT_SENDER=…
 *
 * Адрес и имена полей вынесены в настройки: пока доступов нет, проверить
 * их на живом шлюзе нельзя, и если в документации провайдера они окажутся
 * другими, это правка `config/sms.php`, а не кода.
 *
 * Ответ считается принятым, если шлюз вернул 2xx и в теле нет признака
 * ошибки. Точный разбор статусов появится, когда будет на чём проверить, —
 * выдумывать его сейчас значило бы написать непроверяемый код.
 */
class SmsDiscountClient implements SmsSender
{
    public function send(string $phone, string $text): array
    {
        $login = (string) config('sms.smsdiscount.login');
        $password = (string) config('sms.smsdiscount.password');

        if ($login === '' || $password === '') {
            throw new SmsDeliveryException('SMS-дисконт: не заданы логин и пароль.');
        }

        $url = (string) config('sms.smsdiscount.url');
        $поля = (array) config('sms.smsdiscount.fields', []);

        $ответ = Http::asForm()
            ->timeout((int) config('sms.smsdiscount.timeout', 15))
            ->post($url, [
                ($поля['login'] ?? 'login') => $login,
                ($поля['password'] ?? 'psw') => $password,
                ($поля['phone'] ?? 'phones') => PhoneNormalizer::toSmsGateway($phone),
                ($поля['text'] ?? 'mes') => $text,
                ($поля['sender'] ?? 'sender') => (string) config('sms.smsdiscount.sender'),
                ($поля['format'] ?? 'fmt') => (string) config('sms.smsdiscount.format', '3'),
            ]);

        if ($ответ->failed()) {
            Log::error('SMS-дисконт: шлюз ответил отказом', [
                'status' => $ответ->status(),
                'body' => mb_substr($ответ->body(), 0, 500),
            ]);

            throw new SmsDeliveryException('SMS-дисконт: шлюз ответил '.$ответ->status().'.');
        }

        $тело = $ответ->json() ?? ['raw' => $ответ->body()];

        // Провайдеры этого семейства отдают отказ телом при коде 200.
        if (is_array($тело) && isset($тело['error'])) {
            throw new SmsDeliveryException('SMS-дисконт: '.(string) $тело['error']);
        }

        return is_array($тело) ? $тело : ['raw' => $ответ->body()];
    }
}
