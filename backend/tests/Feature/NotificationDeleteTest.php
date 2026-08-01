<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleted_notification_is_not_returned_on_subsequent_fetch(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $user->notify(new InAppNotification('system', 'Тест', 'Тело', '/feed'));
        $notificationId = $user->notifications()->firstOrFail()->id;

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/v1/users/me/notifications/{$notificationId}")
            ->assertOk()
            ->assertJsonPath('data.deleted', true);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/notifications')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_clear_all_notifications_removes_every_item(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $user->notify(new InAppNotification('system', 'One', 'Body'));
        $user->notify(new InAppNotification('friend_request', 'Two', 'Body'));

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/v1/users/me/notifications')
            ->assertOk();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread', 0);
    }
}
