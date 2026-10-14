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
    /**
     * @param  array<string, mixed>  $options
     */
    public function sendTemplate(string $phone, SmsTemplate $template, array $params = [], array $options = []): array
    {
        $text = $template->render($params);

        return $this->sendRaw($phone, $text, $template, $options);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function sendRaw(string $phone, string $text, ?SmsTemplate $template = null, array $options = []): array
    {
        try {
            return $this->sender->send($phone, $text, $options);
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
