<?php

namespace Modules\Billing\Notifications;

use App\Models\SafeDeal;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Email companion to the in-app deal notification — one per lifecycle step. */
class SafeDealStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly SafeDeal $deal,
        private readonly string $title,
        private readonly string $body,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/deals/'.$this->deal->uuid;
        $listing = $this->deal->listing?->title;

        $mail = (new MailMessage)
            ->subject($this->title.' — Modelizm Club')
            ->greeting('Здравствуйте!')
            ->line($this->title.'.');

        if ($listing) {
            $mail->line('Объявление: '.$listing);
        }

        $mail->line('Сумма сделки: '.number_format($this->deal->amount_kopecks / 100, 2, ',', ' ').' ₽');

        if ($this->body !== '') {
            $mail->line($this->body);
        }

        return $mail
            ->action('Открыть сделку', $url)
            ->line('Статус и историю сделки всегда видно в личном кабинете.');
    }
}
