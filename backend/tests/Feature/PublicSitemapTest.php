<?php

namespace Tests\Feature;

use App\Enums\CommunityStatus;
use App\Enums\ListingStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Адреса для sitemap.xml — только то, что гость может открыть.
 *
 * Страницы собирает фронт (`/sitemap.xml`), список сущностей отдаёт эта ручка
 * одним запросом на тип. В карту не должно попасть ничего, что гость увидит
 * как 404: черновик, снятое или удалённое объявление, заблокированное
 * сообщество, выключенный канал.
 */
class PublicSitemapTest extends TestCase
{
    use RefreshDatabase;

    private function listing(ListingStatus $status, bool $trashed = false): Listing
    {
        $category = ListingCategory::query()->create(['name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1]);
        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory()->create()->id,
            'category_id' => $category->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => $status,
            'published_at' => now(),
        ]);
        if ($trashed) {
            $listing->delete();
        }

        return $listing;
    }

    private function community(CommunityStatus $status): Community
    {
        $category = CommunityCategory::query()->create([
            'name' => 'Категория', 'slug' => 'cat-'.uniqid(), 'sort_order' => 1, 'depth' => 0, 'is_active' => true,
        ]);

        return Community::query()->create([
            'category_id' => $category->id,
            'name' => 'Сообщество '.uniqid(),
            'slug' => 'c-'.uniqid(),
            'status' => $status,
            'created_by' => User::factory()->create()->id,
            'access_type' => 'open',
        ]);
    }

    private function channel(bool $active): Channel
    {
        return Channel::query()->create([
            'name' => 'Канал '.uniqid(),
            'slug' => 'ch-'.uniqid(),
            'owner_id' => User::factory()->create()->id,
            'is_active' => $active,
        ]);
    }

    public function test_only_pages_a_guest_can_open_are_listed(): void
    {
        $published = $this->listing(ListingStatus::Published);
        $draft = $this->listing(ListingStatus::Draft);
        $deleted = $this->listing(ListingStatus::Published, trashed: true);
        $active = $this->community(CommunityStatus::Active);
        $blocked = $this->community(CommunityStatus::Blocked);
        $on = $this->channel(true);
        $off = $this->channel(false);

        $data = $this->getJson('/api/v1/public/sitemap')->assertOk()->json('data');

        $listings = array_column($data['listings'], 'uuid');
        $this->assertContains($published->uuid, $listings);
        $this->assertNotContains($draft->uuid, $listings);
        $this->assertNotContains($deleted->uuid, $listings);

        $communities = array_column($data['communities'], 'slug');
        $this->assertContains($active->slug, $communities);
        $this->assertNotContains($blocked->slug, $communities);

        $channels = array_column($data['channels'], 'slug');
        $this->assertContains($on->slug, $channels);
        $this->assertNotContains($off->slug, $channels);

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $data['listings'][0]['lastmod']);
    }

    public function test_sitemap_is_public_and_cacheable(): void
    {
        $this->getJson('/api/v1/public/sitemap')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=3600, public');
    }
}
