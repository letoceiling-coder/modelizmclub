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

    /**
     * Жалоба на сообщество и канал.
     *
     * ReportService знал про сообщества с самого начала, но в правиле
     * валидации типа их не было: запрос падал на 422, не дойдя до сервиса, —
     * кнопка «Пожаловаться» на странице сообщества не работала ни разу. У
     * каналов не было ни типа, ни кнопки.
     */
    public function test_user_can_report_community_and_channel(): void
    {
        $reporter = User::factory()->create(['status' => UserStatus::Active]);
        $owner = User::factory()->create(['status' => UserStatus::Active]);

        $category = \App\Models\CommunityCategory::create([
            'name' => 'Клубы',
            'slug' => 'clubs-report',
            'sort_order' => 1,
        ]);

        $community = \App\Models\Community::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'category_id' => $category->id,
            'name' => 'Клуб моделистов',
            'slug' => 'club-report',
            'description' => 'Описание',
            'status' => 'active',
        ]);

        $channel = \App\Models\Channel::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'owner_id' => $owner->id,
            'name' => 'Канал обзоров',
            'slug' => 'reviews-report',
            'description' => 'Описание',
            'category' => 'Обзоры',
            'kind' => 'author',
            'avatar_color' => '#333333',
            'banner_color' => '#111111',
            'is_active' => true,
        ]);

        $this->actingAs($reporter, 'sanctum')
            ->postJson('/api/v1/reports', [
                'type' => 'community',
                'target_id' => $community->uuid,
                'reason' => 'spam',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $this->actingAs($reporter, 'sanctum')
            ->postJson('/api/v1/reports', [
                'type' => 'channel',
                'target_id' => $channel->uuid,
                'reason' => 'offensive',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');
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

    public function test_comments_list_sorts_by_reactions_and_time(): void
    {
        $author = User::factory()->create(['status' => UserStatus::Active]);
        $reactor = User::factory()->create(['status' => UserStatus::Active]);
        $postUuid = $this->publishedPostUuid($author);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$postUuid}/comments", ['body' => 'Старый'])
            ->assertCreated();
        $hotUuid = $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$postUuid}/comments", ['body' => 'Популярный'])
            ->assertCreated()
            ->json('data.uuid');
        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$postUuid}/comments", ['body' => 'Новый'])
            ->assertCreated();

        $this->actingAs($reactor, 'sanctum')
            ->postJson("/api/v1/comments/{$hotUuid}/react")
            ->assertOk();

        $this->getJson("/api/v1/posts/{$postUuid}/comments?sort=interesting")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Популярный');

        $this->getJson("/api/v1/posts/{$postUuid}/comments?sort=old")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Старый');

        $this->getJson("/api/v1/posts/{$postUuid}/comments?sort=new")
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Новый');
    }
}
