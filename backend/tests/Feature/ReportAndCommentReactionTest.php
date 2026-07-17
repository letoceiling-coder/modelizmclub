<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportAndCommentReactionTest extends TestCase
{
    use RefreshDatabase;

    private function publishedPostUuid(User $author): string
    {
        config(['feed.auto_publish' => true]);

        $category = PostCategory::create([
            'name' => 'Авиация',
            'slug' => 'aviation-report',
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);

        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Пост для жалобы',
                'body' => 'Содержимое поста.',
                'category_id' => $category->id,
            ])->json('data.uuid');

        $this->actingAs($author, 'sanctum')->postJson("/api/v1/posts/{$uuid}/publish")->assertOk();

        return $uuid;
    }

    public function test_user_can_report_post_and_admin_resolves(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $reporter = User::factory()->create(['status' => UserStatus::Active]);
        $admin = User::factory()->create(['status' => UserStatus::Active, 'role' => UserRole::Admin]);

        $postUuid = $this->publishedPostUuid($author);

        $reportId = $this->actingAs($reporter, 'sanctum')
            ->postJson('/api/v1/reports', [
                'type' => 'post',
                'target_id' => $postUuid,
                'reason' => 'spam',
                'description' => 'Похоже на спам',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->json('data.id');

        // Повторная жалоба до обработки — запрещена.
        $this->actingAs($reporter, 'sanctum')
            ->postJson('/api/v1/reports', [
                'type' => 'post',
                'target_id' => $postUuid,
                'reason' => 'spam',
            ])
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/reports/{$reportId}", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        $this->assertDatabaseHas('reports', [
            'id' => $reportId,
            'status' => 'resolved',
            'resolved_by' => $admin->id,
        ]);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $admin->id,
            'type' => InAppNotification::class,
        ]);
    }

    public function test_cannot_report_own_content(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $postUuid = $this->publishedPostUuid($author);

        $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/reports', [
                'type' => 'post',
                'target_id' => $postUuid,
                'reason' => 'other',
            ])
            ->assertStatus(422);
    }

    public function test_user_can_react_to_comment(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $reactor = User::factory()->create(['status' => UserStatus::Active]);
        $postUuid = $this->publishedPostUuid($author);

        $commentUuid = $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$postUuid}/comments", ['body' => 'Отличная сборка!'])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($reactor, 'sanctum')
            ->postJson("/api/v1/comments/{$commentUuid}/react")
            ->assertOk()
            ->assertJsonPath('data.reactions_count', 1)
            ->assertJsonPath('data.viewer_reacted', true);

        $this->actingAs($reactor, 'sanctum')
            ->deleteJson("/api/v1/comments/{$commentUuid}/react")
            ->assertOk()
            ->assertJsonPath('data.reactions_count', 0)
            ->assertJsonPath('data.viewer_reacted', false);
    }
}
