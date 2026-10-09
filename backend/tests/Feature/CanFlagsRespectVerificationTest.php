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
 * Флаги `can.*` совпадают с тем, что ответит маршрут.
 *
 * Замер прода 07.09: `GET /api/v1/feed` отдавал учётке с неподтверждённым
 * телефоном `can: {react: true, comment: true}`, а `POST /posts/{uuid}/react`
 * отвечал 403. Флаги считала политика, запрещал посредник, друг о друге они
 * не знали. Тогда это починили, сделав флаги такими же строгими, как
 * посредник.
 *
 * **09.10 стена подвинулась, и флаги подвинулись вместе с ней.** Решение З2:
 * телефон нужен для публикации объявления и вывода средств. Реакции,
 * комментарии и правка своей записи телефона не требуют — значит флаги на
 * них больше не ложные, а истинные, и маршрут их пропускает.
 *
 * Правило, которое проверяется, то же самое и не изменилось ни на слово:
 * **флаг и маршрут отвечают одинаково**. Если бы флаги остались строгими,
 * ошибка 07.09 вернулась бы зеркально — человек без телефона не увидел бы
 * кнопки, которую сервер ему разрешает.
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

        // По решению З2 реакция и комментарий телефона не требуют.
        $this->assertTrue($flags['react'], 'реакция разрешена маршрутом — значит и флагом');
        $this->assertTrue($flags['comment'], 'комментарий разрешён маршрутом — значит и флагом');

        // И маршрут отвечает тем же: флаг не врёт ни в ту, ни в другую сторону.
        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$post->uuid}/react", ['type' => 'like'])
            ->assertOk();
    }

    /**
     * Почта осталась стеной, и флаги её видят.
     *
     * Разделение посредника оставило требование почты там, где оно было; эта
     * проверка держит флаги согласованными именно с ним — иначе после З2
     * согласованность проверялась бы только на разрешённом.
     */
    public function test_flags_follow_the_email_wall(): void
    {
        $author = $this->user(true);
        $post = $this->seedPost($author);

        $viewer = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => null,
            'phone_verified_at' => now(),
        ]);
        UserProfile::create([
            'user_id' => $viewer->id,
            'display_name' => 'User '.$viewer->id,
            'slug' => 'user-'.$viewer->id.'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        $flags = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/v1/posts/{$post->uuid}")
            ->assertOk()
            ->json('data.can');

        $this->assertFalse($flags['react'], 'почта не подтверждена — маршрут откажет');

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/posts/{$post->uuid}/react", ['type' => 'like'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'email_not_verified');
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

        // Своя запись: правка и удаление телефона не требуют (решение З2),
        // и маршрут их принимает — проверяем вторым шагом, чтобы флаг и
        // ответ сверялись, а не утверждались по отдельности.
        $this->assertTrue($flags['edit']);
        $this->assertTrue($flags['delete']);

        $this->actingAs($author, 'sanctum')
            ->patchJson("/api/v1/posts/{$post->uuid}", ['body' => 'Поправленное тело'])
            ->assertOk();
    }
}
