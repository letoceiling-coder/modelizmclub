<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

/**
 * Отправка SMS по согласованным с МТС шаблонам.
 */
class SmsMessenger
{
    public function __construct(
        private readonly SmsSender $sender,
    ) {}

    /**
     * @param  array<int, int|string>  $params
     * @return array<string, mixed>
     */
    public function sendTemplate(string $phone, SmsTemplate $template, array $params = []): array
    {
        $text = $template->render($params);

        return $this->sendRaw($phone, $text, $template);
    }

    /**
     * @return array<string, mixed>
     */
    public function sendRaw(string $phone, string $text, ?SmsTemplate $template = null): array
    {
        try {
            return $this->sender->send($phone, $text);
        } catch (SmsDeliveryException $e) {
            Log::error('SMS delivery failed', [
                'phone' => $phone,
                'template' => $template?->value,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
