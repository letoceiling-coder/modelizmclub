<?php

namespace Modules\Call\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A single WebRTC signaling message delivered to one user's private channel.
 * `type` is one of: offer, answer, ice, ringing, reject, hangup, busy.
 */
class CallSignal implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $targetUuid,
        public string $type,
        public array $payload,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('calls.'.$this->targetUuid)];
    }

    public function broadcastAs(): string
    {
        return 'call.signal';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return array_merge(['type' => $this->type], $this->payload);
    }
}
