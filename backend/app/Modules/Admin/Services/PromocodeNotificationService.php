<?php

namespace Modules\Admin\Services;

use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Services\NotificationPolicy;

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
                    $sent += $this->sendPromoChunk($users, $title, $body, $link);
                });

            return $sent;
        }

        User::query()
            ->where('status', UserStatus::Active)
            ->chunkById(500, function ($users) use ($title, $body, $link, &$sent): void {
                $sent += $this->sendPromoChunk($users, $title, $body, $link);
            });

        return $sent;
    }

    /** @param  \Illuminate\Support\Collection<int, User>|\Illuminate\Database\Eloquent\Collection<int, User>  $users */
    private function sendPromoChunk($users, string $title, string $body, string $link): int
    {
        $sent = 0;
        foreach ($users as $user) {
            if (! NotificationPolicy::allows($user, 'promo', 'in_app')) {
                continue;
            }
            InAppNotify::sendQuiet(
                $user,
                new InAppNotification('promo', $title, $body, $link),
            );
            $sent++;
        }

        return $sent;
    }
}
