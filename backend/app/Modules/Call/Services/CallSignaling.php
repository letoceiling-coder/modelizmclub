<?php

namespace Modules\Call\Services;

use App\Events\UserRealtimeEvent;
use Modules\Call\Events\CallSignal;

class CallSignaling
{
    /**
     * Deliver signaling to the peer via dedicated calls channel and personal user channel.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function send(string $targetUuid, string $type, array $payload): void
    {
        try {
            broadcast(new CallSignal($targetUuid, $type, $payload));
            broadcast(new UserRealtimeEvent($targetUuid, 'call', array_merge(['type' => $type], $payload)));
        } catch (\Throwable) {
            // Reverb may be unavailable during maintenance
        }
    }
}
