<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class InAppNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $type   Machine-readable category (e.g. friend_request, message, system).
     * @param  string  $title  Short headline shown in the list.
     * @param  string  $body   Optional longer text.
     * @param  string|null  $link  In-app path to open when the notification is clicked.
     */
    public function __construct(
        public readonly string $type,
        public readonly string $title,
        public readonly string $body = '',
        public readonly ?string $link = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'link' => $this->link,
        ];
    }
}
