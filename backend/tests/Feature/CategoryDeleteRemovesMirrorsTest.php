<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Удаление категории уносит её отражения — или говорит, почему нет.
 *
 * ЧТО БЫЛО. Узел каталога живёт в `post_categories` и ссылается на
 * отражения в `listing_categories` и `community_categories`. Удаление
 * трогало только узел: 29.09 админка ответила «Категория удалена», а обе
 * строки остались в базе сиротами — неактивными, без содержимого и уже
 * без ссылки на узел.
 *
 * Неделей раньше такие же сироты стоили отдельной миграции: направления
 * потеряли родителей, и восстанавливать их пришлось по зеркалам.
 *
 * УДАЛЯЕМ ТОЛЬКО ПУСТЫЕ. За отражением могут стоять чужие объявления; на
 * уровне базы это защищено `RESTRICT`, то есть слепое удаление упало бы
 * исключением посреди запроса. Поэтому сначала спрашиваем, а про
 * оставшееся говорим вслух.
 */
class CategoryDeleteRemovesMirrorsTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    /** @return array{0: PostCategory, 1: ListingCategory, 2: CommunityCategory} */
    private function узелСЗеркалами(string $имя = 'Служебная'): array
    {
        $slug = Str::slug($имя).'-'.Str::random(6);

        $listing = ListingCategory::query()->create(['name' => $имя, 'slug' => $slug.'-l']);
        $community = CommunityCategory::query()->create(['name' => $имя, 'slug' => $slug.'-c']);
        $post = PostCategory::query()->create([
            'name' => $имя,
            'slug' => $slug,
            'listing_category_id' => $listing->id,
            'community_category_id' => $community->id,
        ]);

        return [$post, $listing, $community];
    }

    public function test_пустые_отражения_уходят_вместе_с_узлом(): void
    {
        [$post, $listing, $community] = $this->узелСЗеркалами();

        $ответ = $this->actingAs($this->owner(), 'sanctum')
            ->deleteJson("/api/v1/admin/categories/post/{$post->id}")
            ->assertOk();

        $this->assertNull(PostCategory::query()->find($post->id), 'узел не удалён');
        $this->assertNull(ListingCategory::query()->find($listing->id), 'отражение в объявлениях осталось сиротой');
        $this->assertNull(CommunityCategory::query()->find($community->id), 'отражение в сообществах осталось сиротой');
        $this->assertCount(2, $ответ->json('data.mirrors_deleted'));
        $this->assertSame([], $ответ->json('data.mirrors_kept'));
    }

    public function test_занятое_отражение_остаётся_и_об_этом_сказано(): void
    {
        /*
         * Главная граница. За отражением стоит объявление — удалять его
         * нельзя, и молчать об этом тоже: человек решит, что убрано всё.
         */
        [$post, $listing, $community] = $this->узелСЗеркалами('С объявлением');

        Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->owner()->id,
            'category_id' => $listing->id,
            'title' => 'Лот',
            'slug' => 'lot-'.Str::random(6),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
        ]);

        $ответ = $this->actingAs($this->owner(), 'sanctum')
            ->deleteJson("/api/v1/admin/categories/post/{$post->id}")
            ->assertOk();

        $this->assertNotNull(ListingCategory::query()->find($listing->id), 'удалено отражение с объявлением');
        $this->assertNull(CommunityCategory::query()->find($community->id), 'пустое отражение должно было уйти');

        $оставлено = $ответ->json('data.mirrors_kept');
        $this->assertCount(1, $оставлено);
        $this->assertStringContainsString('привязано записей: 1', $оставлено[0]);
        $this->assertStringContainsString('остались', (string) $ответ->json('data.message'));
    }

    public function test_отражение_с_вложенными_направлениями_остаётся(): void
    {
        [$post, $listing] = $this->узелСЗеркалами('С вложенным');
        ListingCategory::query()->create([
            'name' => 'Вложенное',
            'slug' => 'vlozhennoe-'.Str::random(6),
            'parent_id' => $listing->id,
        ]);

        $ответ = $this->actingAs($this->owner(), 'sanctum')
            ->deleteJson("/api/v1/admin/categories/post/{$post->id}")
            ->assertOk();

        $this->assertNotNull(ListingCategory::query()->find($listing->id));
        $this->assertStringContainsString('вложенные направления (1)', $ответ->json('data.mirrors_kept')[0]);
    }

    public function test_узел_без_отражений_удаляется_как_прежде(): void
    {
        // Контроль: правка не сломала обычное удаление.
        $post = PostCategory::query()->create(['name' => 'Одинокая', 'slug' => 'odinokaya-'.Str::random(6)]);

        $ответ = $this->actingAs($this->owner(), 'sanctum')
            ->deleteJson("/api/v1/admin/categories/post/{$post->id}")
            ->assertOk();

        $this->assertNull(PostCategory::query()->find($post->id));
        $this->assertSame('Категория удалена.', $ответ->json('data.message'));
        $this->assertSame([], $ответ->json('data.mirrors_deleted'));
    }
}
