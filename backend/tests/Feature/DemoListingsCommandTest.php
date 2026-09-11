<?php

namespace Tests\Feature;

use App\Console\Commands\DemoListingsCommand;
use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use App\Support\DemoListingCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Listing\Services\ListingService;
use Tests\TestCase;

/**
 * Тестовые объявления живут на проде рядом с настоящими. Тесты держат то,
 * от чего зависит безопасность: сухой прогон не пишет; каждое объявление
 * помечено и опубликовано без оплаты; удаление трогает только демо-продавцов
 * и отказывается, если по демо-объявлению есть сделка живого покупателя.
 */
class DemoListingsCommandTest extends TestCase
{
    use RefreshDatabase;

    private const ONLY = ['armor-spg', 'armor-rc'];

    protected function setUp(): void
    {
        parent::setUp();

        if (! function_exists('imagecreatetruecolor') || ! function_exists('imagejpeg')) {
            $this->markTestSkipped('Нет GD — картинки не из чего сделать.');
        }

        Storage::fake('s3');
        config(['filesystems.default' => 's3', 'media.variants.enabled' => false]);

        $armor = PostCategory::query()->create([
            'name' => 'Бронетехника', 'slug' => 'armor', 'depth' => 0, 'path' => 'armor', 'is_active' => true,
        ]);
        foreach (['armor-spg' => 'САУ', 'armor-rc' => 'Радиоуправляемые танки'] as $slug => $name) {
            PostCategory::query()->create([
                'name' => $name, 'slug' => $slug, 'parent_id' => $armor->id,
                'depth' => 1, 'path' => 'armor/'.$slug, 'is_active' => true,
            ]);
        }
    }

    /** @return Builder<Listing> */
    private function demoListings()
    {
        return Listing::query()->whereIn(
            'user_id',
            User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->pluck('id'),
        );
    }

    private function expected(): int
    {
        return count(DemoListingCatalog::ITEMS['armor-spg']) + count(DemoListingCatalog::ITEMS['armor-rc']);
    }

    public function test_сухой_прогон_ничего_не_пишет(): void
    {
        $this->artisan('listings:demo', ['--dry-run' => true, '--only' => self::ONLY])->assertExitCode(0);

        $this->assertSame(0, User::query()->count());
        $this->assertSame(0, Listing::query()->count());
    }

    public function test_заводит_помеченные_опубликованные_объявления_с_фото(): void
    {
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);

        $listings = $this->demoListings()->get();
        $this->assertCount($this->expected(), $listings);

        $spg = ListingCategory::query()->where('path', 'armor/armor-spg')->value('id');
        $this->assertSame(
            count(DemoListingCatalog::ITEMS['armor-spg']),
            $listings->where('subcategory_id', $spg)->count(),
        );

        foreach ($listings as $listing) {
            $this->assertSame(ListingStatus::Published, $listing->status);
            $this->assertStringStartsWith(DemoListingsCommand::MARKER, (string) $listing->description);
            $this->assertNull($listing->placement_payment_id);
            $this->assertSame(2, DB::table('listing_media')->where('listing_id', $listing->id)->count());
        }
        $this->assertSame(0, DB::table('payments')->count());
    }

    public function test_повторный_запуск_не_дублирует(): void
    {
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);

        $this->assertSame($this->expected(), $this->demoListings()->count());
    }

    public function test_удаление_трогает_только_демо_продавцов(): void
    {
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);

        $person = User::factory()->create();
        $own = app(ListingService::class)->create($person, [
            'taxonomy_id' => PostCategory::query()->where('slug', 'armor-spg')->value('id'),
            'title' => 'Настоящее объявление',
            'description' => 'Живой продавец.',
            'price_cents' => 100000,
            'delivery_methods' => ['Почта России'],
            'publish' => false,
        ]);

        $this->artisan('listings:demo', ['--purge' => true])->assertExitCode(0);

        $this->assertSame(0, User::withTrashed()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->count());
        $this->assertSame(1, Listing::withTrashed()->count());
        $this->assertTrue(Listing::query()->whereKey($own->id)->exists());
    }

    public function test_удаление_отказывается_если_есть_сделка(): void
    {
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);
        $listing = $this->demoListings()->firstOrFail();
        $buyer = User::factory()->create();
        DB::table('safe_deals')->insert([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $listing->user_id,
            'amount_kopecks' => 100000,
            'seller_payout_kopecks' => 95000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('listings:demo', ['--purge' => true])->assertExitCode(1);

        $this->assertSame($this->expected(), $this->demoListings()->count());
        $this->assertSame(1, DB::table('safe_deals')->count());
    }

    public function test_неизвестный_узел_в_only_останавливает(): void
    {
        $this->artisan('listings:demo', ['--only' => ['no-such-node']])->assertExitCode(1);

        $this->assertSame(0, Listing::query()->count());
    }
}
