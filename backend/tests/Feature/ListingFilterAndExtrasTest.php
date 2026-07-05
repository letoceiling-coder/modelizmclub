<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ListingFilterAndExtrasTest extends TestCase
{
    use RefreshDatabase;

    private function category(string $slug = 'parts'): ListingCategory
    {
        return ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => $slug,
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    private function listing(User $user, ListingCategory $category, string $title, int $priceCents, ?int $views = 0): Listing
    {
        return Listing::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => $title,
            'slug' => Str::slug($title),
            'description' => 'Описание '.$title,
            'price_cents' => $priceCents,
            'views_count' => $views,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function test_listings_filter_by_price_and_sort_by_price(): void
    {
        $category = $this->category();
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->listing($user, $category, 'Дешёвый мотор', 100_00);
        $this->listing($user, $category, 'Средний мотор', 500_00);
        $this->listing($user, $category, 'Дорогой мотор', 900_00);

        // price_min/price_max в рублях
        $this->getJson('/api/v1/listings?price_min=200&price_max=800')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Средний мотор');

        $this->getJson('/api/v1/listings?sort=price_asc')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Дешёвый мотор')
            ->assertJsonPath('meta.sort', 'price_asc');

        $this->getJson('/api/v1/listings?sort=price_desc')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Дорогой мотор');
    }

    public function test_listings_sort_frontend_aliases(): void
    {
        $category = $this->category();
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->listing($user, $category, 'Дешёвый мотор', 100_00);
        $this->listing($user, $category, 'Дорогой мотор', 900_00);

        $this->getJson('/api/v1/listings?sort=cheap')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Дешёвый мотор');

        $this->getJson('/api/v1/listings?sort=expensive')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Дорогой мотор');

        $this->getJson('/api/v1/listings?sort=new')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_listings_search_and_popular_sort(): void
    {
        $category = $this->category();
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $this->listing($user, $category, 'Пропеллер APC', 50_00, views: 3);
        $this->listing($user, $category, 'Аккумулятор LiPo', 80_00, views: 99);

        $this->getJson('/api/v1/listings?q=пропеллер')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Пропеллер APC');

        $this->getJson('/api/v1/listings?sort=popular')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Аккумулятор LiPo');
    }

    public function test_favorite_flow_and_my_favorites(): void
    {
        $category = $this->category();
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $viewer = User::factory()->create(['status' => UserStatus::Active]);

        $listing = $this->listing($owner, $category, 'Сервомашинка', 30_00);

        $this->actingAs($viewer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/favorite")
            ->assertOk()
            ->assertJsonPath('data.is_favorite', true)
            ->assertJsonPath('data.favorites_count', 1);

        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/v1/users/me/favorites')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.uuid', $listing->uuid);

        $this->actingAs($viewer, 'sanctum')
            ->deleteJson("/api/v1/listings/{$listing->uuid}/favorite")
            ->assertOk()
            ->assertJsonPath('data.is_favorite', false)
            ->assertJsonPath('data.favorites_count', 0);
    }

    public function test_ai_suggest_returns_category_and_description(): void
    {
        $this->category('dvigateli');
        $user = User::factory()->create(['status' => UserStatus::Active]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/listings/ai-suggest', [
                'title' => 'Продам двигатели для самолёта',
            ])
            ->assertOk()
            ->assertJsonPath('data.source', 'heuristic');

        $this->assertNotEmpty($response->json('data.description'));
        $this->assertSame('dvigateli', $response->json('data.category.slug'));
    }
}
