<?php

namespace Modules\Auth\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VerificationCodeNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly string $code) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Код подтверждения — Modelizm Club')
            ->greeting('Здравствуйте!')
            ->line('Ваш код подтверждения регистрации:')
            ->line('**'.$this->code.'**')
            ->line('Код действует 30 минут. Если вы не регистрировались, просто проигнорируйте это письмо.');
    }
}
