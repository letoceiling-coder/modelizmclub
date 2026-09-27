<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\UserStatus;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Сохранённое показывается целиком, а не из первой страницы ленты.
 *
 * Закладки всегда хранились в `post_bookmarks`, но списка на сервере не было.
 * Вкладка «Сохранённое» брала общую ленту и отбирала из неё записи с поднятым
 * признаком `viewer.bookmarked`:
 *
 *     if (filter === "saved") return visiblePosts.filter((p) => p.isSaved);
 *
 * Приёмка 27.09 замерила последствие: в ленте 154 записи по 20 на страницу,
 * значит на первом экране вкладка показывала сохранённое только из первых
 * двадцати. Запись, отложенная давно, не появлялась, пока человек не
 * долистает до неё; запись, ушедшая из ленты, не появлялась никогда.
 */
class BookmarkedPostsTest extends TestCase
{
    use RefreshDatabase;

    private function человек(): User
    {
        return User::factory()->create(['status' => UserStatus::Active]);
    }

    private function записи(User $author, int $сколько): array
    {
        $category = PostCategory::query()->firstOrCreate(
            ['slug' => 'aviaciya-zakladki'],
            ['name' => 'Авиация', 'sort_order' => 1, 'depth' => 0, 'is_active' => true],
        );

        $out = [];
        for ($i = 0; $i < $сколько; $i++) {
            $out[] = Post::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $author->id,
                'category_id' => $category->id,
                'title' => "Запись {$i}",
                'body' => 'Текст.',
                'status' => ContentStatus::Published,
                // Чем больше номер, тем новее: первая запись окажется глубоко.
                'published_at' => now()->subDays($сколько - $i),
            ]);
        }

        return $out;
    }

    /**
     * Главное: закладка на глубокой записи видна сразу.
     *
     * Записей больше, чем на странице ленты, и отложена самая старая — та,
     * до которой прежняя вкладка добралась бы только прокруткой.
     */
    public function test_сохранённое_видно_даже_если_запись_глубоко_в_ленте(): void
    {
        $автор = $this->человек();
        $читатель = $this->человек();
        $записи = $this->записи($автор, 25);

        $самаяСтарая = $записи[0];

        $this->actingAs($читатель, 'sanctum')
            ->postJson("/api/v1/posts/{$самаяСтарая->uuid}/bookmark")
            ->assertOk();

        // Убеждаемся, что она действительно не на первой странице ленты.
        $первая = collect($this->actingAs($читатель, 'sanctum')
            ->getJson('/api/v1/feed?per_page=20')->json('data'))->pluck('uuid')->all();

        $this->assertNotContains(
            $самаяСтарая->uuid,
            $первая,
            'подготовка теста: запись должна быть вне первой страницы, иначе он ничего не проверяет',
        );

        $сохранённое = collect($this->actingAs($читатель, 'sanctum')
            ->getJson('/api/v1/posts/bookmarked')->assertOk()->json('data'))->pluck('uuid')->all();

        $this->assertSame(
            [$самаяСтарая->uuid],
            $сохранённое,
            'сохранённое обязано показываться независимо от того, где запись лежит в ленте',
        );
    }

    public function test_порядок_по_времени_сохранения(): void
    {
        $автор = $this->человек();
        $читатель = $this->человек();
        [$первая, $вторая, $третья] = $this->записи($автор, 3);

        foreach ([$вторая, $первая, $третья] as $запись) {
            $this->actingAs($читатель, 'sanctum')
                ->postJson("/api/v1/posts/{$запись->uuid}/bookmark")
                ->assertOk();
            $this->travel(1)->minutes();
        }

        $порядок = collect($this->actingAs($читатель, 'sanctum')
            ->getJson('/api/v1/posts/bookmarked')->assertOk()->json('data'))->pluck('uuid')->all();

        $this->assertSame(
            [$третья->uuid, $первая->uuid, $вторая->uuid],
            $порядок,
            'сверху должно быть отложенное последним: человек ищет то, что только что сохранил',
        );
    }

    public function test_снятая_закладка_уходит_из_списка(): void
    {
        $автор = $this->человек();
        $читатель = $this->человек();
        [$запись] = $this->записи($автор, 1);

        $this->actingAs($читатель, 'sanctum')->postJson("/api/v1/posts/{$запись->uuid}/bookmark")->assertOk();
        $this->assertCount(1, $this->actingAs($читатель, 'sanctum')->getJson('/api/v1/posts/bookmarked')->json('data'));

        $this->actingAs($читатель, 'sanctum')->deleteJson("/api/v1/posts/{$запись->uuid}/bookmark")->assertOk();
        $this->assertCount(0, $this->actingAs($читатель, 'sanctum')->getJson('/api/v1/posts/bookmarked')->json('data'));
    }

    public function test_чужие_закладки_не_видны(): void
    {
        $автор = $this->человек();
        $первый = $this->человек();
        $второй = $this->человек();
        [$запись] = $this->записи($автор, 1);

        $this->actingAs($первый, 'sanctum')->postJson("/api/v1/posts/{$запись->uuid}/bookmark")->assertOk();

        $this->assertCount(
            0,
            $this->actingAs($второй, 'sanctum')->getJson('/api/v1/posts/bookmarked')->json('data'),
            'закладки одного человека не должны попадать в список другого',
        );
    }

    /**
     * Адрес не перехватывается маршрутом записи по идентификатору.
     *
     * `posts/bookmarked` стоит рядом с `posts/{uuid}`, и без ограничения на
     * вид идентификатора слово «bookmarked» могло бы уехать в показ записи.
     */
    public function test_адрес_не_путается_с_записью(): void
    {
        $читатель = $this->человек();

        $this->actingAs($читатель, 'sanctum')
            ->getJson('/api/v1/posts/bookmarked')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_гость_списка_не_получает(): void
    {
        $this->getJson('/api/v1/posts/bookmarked')->assertUnauthorized();
    }
}
