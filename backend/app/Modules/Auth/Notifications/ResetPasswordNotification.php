<?php

namespace Modules\Auth\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as BaseResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends BaseResetPassword
{
    public function toMail(object $notifiable): MailMessage
    {
        $url = $this->resetUrl($notifiable);
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

        return (new MailMessage)
            ->subject('Сброс пароля — МоДелизМ Клуб')
            ->greeting('Здравствуйте!')
            ->line('Вы получили это письмо, потому что мы получили запрос на сброс пароля для вашего аккаунта.')
            ->action('Создать новый пароль', $url)
            ->line('Ссылка действует '.$minutes.' минут.')
            ->line('Если кнопка не открывается, скопируйте ссылку и вставьте её в адресную строку браузера:')
            ->line($url)
            ->line('Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо — никаких действий не требуется.')
            ->salutation('С уважением, команда МоДелизМ Клуб');
    }

    protected function resetUrl(object $notifiable): string
    {
        if (static::$createUrlCallback) {
            return call_user_func(static::$createUrlCallback, $notifiable, $this->token);
        }

        $base = rtrim((string) config('app.frontend_url'), '/');

        return $base.'/reset-password?token='.$this->token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
    }
}
