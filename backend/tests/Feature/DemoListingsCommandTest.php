<?php

namespace Tests\Feature;

use App\Console\Commands\DemoListingsCommand;
use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use App\Support\Demo\DemoPeople;
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

    /**
     * `--only` называет узлы дерева и всегда означал «сделай объявления».
     * После появления остальных разделов вызов с `--only` не должен тянуть за
     * собой людей, записи и сообщества — иначе старые вызовы и этот же тест
     * начали бы делать совсем другое.
     */
    public function test_only_делает_только_объявления(): void
    {
        $this->artisan('listings:demo', ['--only' => self::ONLY])->assertExitCode(0);

        $this->assertSame($this->expected(), $this->demoListings()->count());
        $this->assertSame(0, DB::table('posts')->count());
        $this->assertSame(0, DB::table('friend_requests')->count());
        $this->assertSame(4, User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->count());
    }

    public function test_сухой_прогон_набора_ничего_не_пишет(): void
    {
        $this->artisan('listings:demo', ['--dry-run' => true, '--section' => ['users', 'friends', 'posts']])
            ->assertExitCode(0);

        $this->assertSame(0, User::query()->count());
        $this->assertSame(0, DB::table('posts')->count());
        $this->assertSame(0, DB::table('friend_requests')->count());
    }

    public function test_люди_получают_заявленные_ступени_доступа(): void
    {
        // Тариф нужен по-настоящему: без строки в `subscription_plans` выдавать
        // подписку не на что, и раздел молча создаст людей без неё. На проде
        // тарифы есть, в чистой тестовой базе — нет.
        DB::table('subscription_plans')->insert([
            'name' => 'Год',
            'slug' => 'year',
            'price_cents' => 100000,
            'period_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // И администратор: подписку выдаёт он, его идентификатор — то самое
        // основание доступа, без которого строка в таблице ничего не открывает.
        User::factory()->create(['role' => \App\Enums\UserRole::Admin]);

        $this->artisan('listings:demo', ['--section' => ['users']])->assertExitCode(0);

        $people = User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->get();
        $this->assertCount(count(DemoPeople::roster()), $people);

        $withPhone = $people->filter(fn (User $u): bool => $u->phone_verified_at !== null)->count();
        $this->assertSame(20, $withPhone);

        // Подписка проверяется не строкой в таблице, а тем же вопросом, что
        // задаёт приложение: открыт ли доступ на самом деле.
        $subscribers = $people->filter(fn (User $u): bool => $u->hasActiveSubscription())->count();
        $this->assertSame(12, $subscribers);
    }

    public function test_записи_покрывают_все_варианты_состава_медиа(): void
    {
        $this->artisan('listings:demo', ['--section' => ['users', 'posts']])->assertExitCode(0);

        $ids = User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->pluck('id');
        $posts = DB::table('posts')->whereIn('user_id', $ids)->whereNull('repost_of_id')->pluck('id');

        $byCount = [];
        foreach ($posts as $id) {
            $n = DB::table('post_media')->where('post_id', $id)->count();
            $byCount[$n] = ($byCount[$n] ?? 0) + 1;
        }

        // Без медиа, и по пять записей на каждое число фотографий от одной до
        // десяти. Видео в этой сборке может не собраться (нет ffmpeg), поэтому
        // проверяем фотографии, а не общее число вложений.
        $this->assertArrayHasKey(0, $byCount);
        for ($n = 2; $n <= 10; $n++) {
            $this->assertSame(5, $byCount[$n] ?? 0, "записей с {$n} фото");
        }
    }

    public function test_удаление_отказывается_если_внутри_есть_чужое(): void
    {
        $this->artisan('listings:demo', ['--section' => ['users', 'posts']])->assertExitCode(0);

        $outsider = User::factory()->create();
        $post = DB::table('posts')
            ->whereIn('user_id', User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->pluck('id'))
            ->first();
        DB::table('comments')->insert([
            'uuid' => (string) Str::uuid(),
            'commentable_type' => \App\Models\Post::class,
            'commentable_id' => $post->id,
            'user_id' => $outsider->id,
            'body' => 'Живой человек под демо-записью.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('listings:demo', ['--purge' => true])->assertExitCode(1);
        $this->assertTrue(User::query()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->exists());

        $this->artisan('listings:demo', ['--purge' => true, '--force' => true])->assertExitCode(0);
        $this->assertFalse(User::withTrashed()->where('email', 'like', '%@'.DemoListingsCommand::EMAIL_DOMAIN)->exists());
    }
}
