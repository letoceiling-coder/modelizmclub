<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Post;
use App\Models\PostView;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Запись ленты помнит, кто её смотрел.
 *
 * До 03.10 просмотр жил ключом в кэше: кто смотрел — нигде, а сброс
 * Redis разрешал тем же людям досчитать счётчик заново. Теперь строка в
 * `post_views`, и уникальность стережёт база.
 */
class PostViewLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function запись(User $автор): Post
    {
        return Post::query()->create([
            'uuid' => Str::uuid()->toString(),
            'user_id' => $автор->id,
            'title' => 'Запись',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function test_просмотр_записывается_с_именем_человека(): void
    {
        $автор = User::factory()->create();
        $читатель = User::factory()->create();
        $post = $this->запись($автор);

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$post->uuid}/view")
            ->assertOk();

        $строка = PostView::query()->where('post_id', $post->id)->first();

        $this->assertNotNull($строка, 'просмотр не записан');
        $this->assertSame($читатель->id, $строка->user_id, 'не видно, кто смотрел');
        $this->assertSame('u:'.$читатель->id, $строка->viewer_key);
        $this->assertSame(1, (int) $post->fresh()->views_count);
    }

    public function test_повторный_заход_в_тот_же_день_не_считается(): void
    {
        $автор = User::factory()->create();
        $читатель = User::factory()->create();
        $post = $this->запись($автор);

        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($читатель, 'sanctum')
                ->postJson("/api/v1/posts/{$post->uuid}/view")
                ->assertOk();
        }

        $this->assertSame(1, PostView::query()->where('post_id', $post->id)->count());
        $this->assertSame(1, (int) $post->fresh()->views_count);
    }

    public function test_сброс_кэша_не_разрешает_досчитать_заново(): void
    {
        $автор = User::factory()->create();
        $читатель = User::factory()->create();
        $post = $this->запись($автор);

        $this->actingAs($читатель, 'sanctum')->postJson("/api/v1/posts/{$post->uuid}/view")->assertOk();

        /*
         * Ровно то, что ломало счёт раньше: ключи просмотра жили в кэше,
         * и его чистка возвращала всем право посчитаться второй раз.
         */
        Cache::flush();

        $this->actingAs($читатель, 'sanctum')->postJson("/api/v1/posts/{$post->uuid}/view")->assertOk();

        $this->assertSame(1, (int) $post->fresh()->views_count, 'счётчик вырос после сброса кэша');
    }

    public function test_разные_люди_считаются_отдельно(): void
    {
        $автор = User::factory()->create();
        $post = $this->запись($автор);
        $люди = [User::factory()->create(), User::factory()->create()];

        foreach ($люди as $кто) {
            $this->actingAs($кто, 'sanctum')->postJson("/api/v1/posts/{$post->uuid}/view")->assertOk();
        }

        $this->assertSame(2, (int) $post->fresh()->views_count);
        $this->assertEqualsCanonicalizing(
            array_map(fn (User $u) => $u->id, $люди),
            PostView::query()->where('post_id', $post->id)->pluck('user_id')->all(),
            'список смотревших не совпадает с теми, кто смотрел',
        );
    }

    public function test_автор_себе_просмотр_не_пишет(): void
    {
        $автор = User::factory()->create();
        $post = $this->запись($автор);

        $this->actingAs($автор, 'sanctum')->postJson("/api/v1/posts/{$post->uuid}/view")->assertOk();

        $this->assertSame(0, PostView::query()->where('post_id', $post->id)->count());
        $this->assertSame(0, (int) $post->fresh()->views_count);
    }

    public function test_гость_считается_строкой_без_человека(): void
    {
        $автор = User::factory()->create();
        $post = $this->запись($автор);

        $this->withHeader('X-Guest-Viewer', 'guest-abcdef12')
            ->postJson("/api/v1/posts/{$post->uuid}/view")
            ->assertOk();

        $строка = PostView::query()->where('post_id', $post->id)->firstOrFail();

        $this->assertNull($строка->user_id, 'гость записан человеком');
        $this->assertSame(1, (int) $post->fresh()->views_count);
    }

    /**
     * Мягкое удаление просмотры не трогает, окончательное — уносит.
     *
     * `Post` удаляется мягко, и это правильно: скрытая запись может
     * вернуться, а с ней должно вернуться и число просмотров. Каскад
     * срабатывает только на настоящем удалении строки — тогда сиротам
     * взяться неоткуда.
     *
     * Первая версия этой проверки ждала нуля после обычного `delete()`
     * и падала. Падала она на моей посылке, а не на коде.
     */
    public function test_мягкое_удаление_просмотры_сохраняет_а_полное_уносит(): void
    {
        $автор = User::factory()->create();
        $читатель = User::factory()->create();
        $post = $this->запись($автор);

        $this->actingAs($читатель, 'sanctum')->postJson("/api/v1/posts/{$post->uuid}/view")->assertOk();
        $id = $post->id;

        $post->delete();
        $this->assertSame(
            1,
            PostView::query()->where('post_id', $id)->count(),
            'мягкое удаление унесло просмотры — вернуть запись будет не с чем',
        );

        $post->forceDelete();
        $this->assertSame(0, PostView::query()->where('post_id', $id)->count(), 'просмотры остались сиротами');
    }
}
