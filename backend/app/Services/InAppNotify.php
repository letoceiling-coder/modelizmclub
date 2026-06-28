<?php

namespace App\Services;

use App\Events\UserRealtimeEvent;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Notifications\DatabaseNotification;

class InAppNotify
{
    /**
     * Persist an in-app notification and push it to the user's realtime channel.
     *
     * @param  array<string, mixed>|null  $realtimePayload  Extra payload for {@see UserRealtimeEvent}
     */
    public static function send(
        User $user,
        InAppNotification $notification,
        ?string $realtimeType = 'notification',
        ?array $realtimePayload = null,
    ): void {
        $user->notify($notification);

        $dbn = $user->notifications()->latest('created_at')->first();
        if ($dbn instanceof DatabaseNotification) {
            broadcast(new UserRealtimeEvent($user->uuid, 'notification', [
                'notification' => self::present($dbn),
            ]));
        }

        if ($realtimeType !== null && $realtimePayload !== null && $realtimeType !== 'notification') {
            broadcast(new UserRealtimeEvent($user->uuid, $realtimeType, $realtimePayload));
        }
    }

    /** @return array<string, mixed> */
    public static function present(DatabaseNotification $n): array
    {
        $data = is_array($n->data) ? $n->data : (array) json_decode((string) $n->data, true);

        return [
            'id' => $n->id,
            'type' => $data['type'] ?? 'system',
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'link' => $data['link'] ?? null,
            'read' => $n->read_at !== null,
            'created_at' => $n->created_at?->toIso8601String(),
        ];
    }
}
