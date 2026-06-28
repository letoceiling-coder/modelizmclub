<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Personal realtime envelope for a single user (messages, in-app notifications, etc.).
 */
class UserRealtimeEvent implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

  /**
   * @param  array<string, mixed>  $payload
   */
    public function __construct(
        public string $userUuid,
        public string $type,
        public array $payload,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userUuid)];
    }

    public function broadcastAs(): string
    {
        return 'user.event';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'type' => $this->type,
            'payload' => $this->payload,
        ];
    }
}
