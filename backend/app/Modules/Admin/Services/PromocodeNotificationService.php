<?php

namespace Modules\Admin\Services;

use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Support\Facades\Notification;

class PromocodeNotificationService
{
    /** @param  array{title?: string|null, body?: string|null, user_ids?: list<int>}  $options */
    public function sendForPromocode(Promocode $promocode, string $mode, array $options = []): int
    {
        $title = trim((string) ($options['title'] ?? '')) ?: 'Промокод для размещения объявлений';
        $body = trim((string) ($options['body'] ?? ''));
        if ($body === '') {
            $body = "Используйте промокод {$promocode->code} при размещении объявления и получите скидку.";
        }

        $link = '/ads/new?promo='.urlencode($promocode->code);
        $sent = 0;

        if ($mode === 'selected') {
            $ids = array_values(array_filter(array_map('intval', $options['user_ids'] ?? [])));
            if ($ids === []) {
                return 0;
            }

            User::query()
                ->whereIn('id', $ids)
                ->where('status', UserStatus::Active)
                ->chunkById(200, function ($users) use ($title, $body, $link, &$sent): void {
                    Notification::send($users, new InAppNotification('promo', $title, $body, $link));
                    $sent += $users->count();
                });

            return $sent;
        }

        User::query()
            ->where('status', UserStatus::Active)
            ->chunkById(500, function ($users) use ($title, $body, $link, &$sent): void {
                Notification::send($users, new InAppNotification('promo', $title, $body, $link));
                $sent += $users->count();
            });

        return $sent;
    }
}
