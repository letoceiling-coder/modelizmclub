<?php

namespace App\Services;

use App\Events\UserRealtimeEvent;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;
use Throwable;

class InAppNotify
{
    /**
     * Persist an in-app notification and push it to the user's realtime channel.
     *
     * The realtime push is best-effort: a broadcast-driver failure (Reverb
     * unreachable, misconfigured channel auth, etc.) must not fail the
     * caller's primary action (e.g. sending a friend request, a chat
     * message, a call) — that action already succeeded in the database by
     * the time we get here. Previously an unguarded broadcast() exception
     * here bubbled all the way up to a 500, so the client reported the
     * whole request as failed even though the friend request / message /
     * call row was already committed.
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
            self::broadcastSafely(new UserRealtimeEvent($user->uuid, 'notification', [
                'notification' => self::present($dbn),
            ]));
        }

        if ($realtimeType !== null && $realtimePayload !== null && $realtimeType !== 'notification') {
            self::broadcastSafely(new UserRealtimeEvent($user->uuid, $realtimeType, $realtimePayload));
        }
    }

    private static function broadcastSafely(UserRealtimeEvent $event): void
    {
        try {
            broadcast($event);
        } catch (Throwable $e) {
            Log::warning('InAppNotify: realtime broadcast failed, notification was still persisted', [
                'exception' => $e->getMessage(),
            ]);
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
