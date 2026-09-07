<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\PostCategory;
use App\Enums\UserStatus;
use App\Models\Post;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Флаги `can.*` не обещают того, что запретит middleware `verified`.
 *
 * Замер прода 07.09: `GET /api/v1/feed` отдавал учётке с неподтверждённым
 * телефоном `can: {react: true, comment: true}`, а `POST /posts/{uuid}/react`
 * отвечал 403. Флаги считала политика, запрещал middleware, друг о друге они
 * не знали.
 */
class CanFlagsRespectVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function user(bool $phoneVerified): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => $phoneVerified ? now() : null,
        ]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'User '.$user->id,
            'slug' => 'user-'.$user->id.'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedPost(User $author): Post
    {
        $category = PostCategory::query()->create([
            'name' => 'Проверка', 'slug' => 'check-'.uniqid(), 'sort_order' => 1,
        ]);

        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => 'Пост для проверки флагов',
            'body' => 'Тело поста',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function test_flags_and_route_agree_for_an_unverified_phone(): void
    {
        $author = $this->user(true);
        $post = $this->seedPost($author);
        $viewer = $this->user(false);

        $flags = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->json('data.can');

        $this->assertFalse($flags['react'], 'обещать реакцию нельзя: маршрут её запретит');
        $this->assertFalse($flags['comment'], 'обещать комментарий нельзя: маршрут его запретит');

        // Ровно то, чем оборачивался обман на проде.
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$post->uuid}/react", ['type' => 'like'])
            ->assertStatus(403);
    }

    public function test_a_verified_viewer_still_gets_true(): void
    {
        $author = $this->user(true);
        $post = $this->seedPost($author);
        $viewer = $this->user(true);

        $flags = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->json('data.can');

        $this->assertTrue($flags['react']);
        $this->assertTrue($flags['comment']);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$post->uuid}/react", ['type' => 'like'])
            ->assertOk();
    }

    public function test_author_flags_follow_the_same_wall(): void
    {
        $author = $this->user(false);
        $post = $this->seedPost($author);

        $flags = $this->actingAs($author, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->json('data.can');

        // Свой пост, но правка тоже за стеной `verified`.
        $this->assertFalse($flags['edit']);
        $this->assertFalse($flags['delete']);
    }
}
