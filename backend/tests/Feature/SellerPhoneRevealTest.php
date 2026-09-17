<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingPhoneReveal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Listing\Services\SellerPhoneRevealService;
use Tests\TestCase;

/**
 * «Позвонить продавцу»: номер только по отдельному запросу, с журналом и
 * ограничением частоты, и только если продавец его показывает.
 */
class SellerPhoneRevealTest extends TestCase
{
    use RefreshDatabase;

    private const PHONE = '+79996371182';

    private ListingCategory $category;

    private User $seller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->category = ListingCategory::create([
            'name' => 'Двигатели',
            'slug' => 'engines-'.Str::random(6),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
        $this->seller = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => self::PHONE,
            'phone_verified_at' => now(),
        ]);
    }

    private function listing(array $overrides = []): Listing
    {
        $title = 'Пропеллер '.Str::random(6);

        return Listing::create(array_merge([
            'user_id' => $this->seller->id,
            'category_id' => $this->category->id,
            'title' => $title,
            'slug' => Str::slug($title),
            'description' => 'Описание',
            'price_cents' => 120_00,
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ], $overrides));
    }

    private function buyer(): User
    {
        return User::factory()->create(['status' => UserStatus::Active]);
    }

    private function reveal(User $viewer, Listing $listing, string $ip = '203.0.113.10')
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($viewer, 'sanctum')
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson("/api/v1/listings/{$listing->uuid}/reveal-phone");
    }

    public function test_number_is_not_in_list_or_card_only_the_flag(): void
    {
        $listing = $this->listing();
        $digits = substr(self::PHONE, -7);

        $list = $this->getJson('/api/v1/listings')->assertOk();
        $this->assertStringNotContainsString($digits, $list->getContent());
        $row = collect($list->json('data'))->firstWhere('uuid', $listing->uuid);
        $this->assertTrue($row['phone_available']);

        $card = $this->actingAs($this->buyer(), 'sanctum')->getJson("/api/v1/listings/{$listing->uuid}")->assertOk();
        $this->assertStringNotContainsString($digits, $card->getContent());
        $card->assertJsonPath('data.phone_available', true)->assertJsonMissingPath('data.show_phone');
    }

    public function test_reveal_returns_the_number_and_writes_the_log(): void
    {
        $listing = $this->listing();
        $buyer = $this->buyer();

        $this->reveal($buyer, $listing)
            ->assertOk()
            ->assertJsonPath('data.phone', self::PHONE)
            ->assertJsonPath('data.expires_at', null);

        $log = ListingPhoneReveal::query()->sole();
        $this->assertSame($buyer->id, $log->viewer_id);
        $this->assertSame($listing->id, $log->listing_id);
        $this->assertSame($this->seller->id, $log->seller_id);
        $this->assertSame('profile', $log->provider);
        $this->assertSame('203.0.113.10', $log->ip_address);
        $this->assertNotNull($log->created_at);
    }

    public function test_guest_gets_401_and_nothing_is_logged(): void
    {
        $listing = $this->listing();

        $this->postJson("/api/v1/listings/{$listing->uuid}/reveal-phone")->assertUnauthorized();
        $this->assertSame(0, ListingPhoneReveal::query()->count());
    }

    public function test_seller_switch_hides_the_button_and_the_number_without_remoderation(): void
    {
        $listing = $this->listing();

        $this->actingAs($this->buyer(), 'sanctum')
            ->putJson("/api/v1/listings/{$listing->uuid}/phone-visibility", ['show_phone' => false])
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->seller, 'sanctum')
            ->putJson("/api/v1/listings/{$listing->uuid}/phone-visibility", ['show_phone' => false])
            ->assertOk()
            ->assertJsonPath('data.show_phone', false)
            ->assertJsonPath('data.phone_available', false);

        $this->assertSame(ListingStatus::Published, $listing->fresh()->status);

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/listings/{$listing->uuid}")->assertJsonPath('data.phone_available', false);
        $this->reveal($this->buyer(), $listing)->assertNotFound()->assertJsonPath('message', 'Номер недоступен.');
        $this->assertSame(0, ListingPhoneReveal::query()->count());
    }

    public function test_seller_without_verified_phone_has_no_button(): void
    {
        $this->seller->forceFill(['phone_verified_at' => null])->save();
        $listing = $this->listing();

        $this->getJson("/api/v1/listings/{$listing->uuid}")->assertJsonPath('data.phone_available', false);
        $this->reveal($this->buyer(), $listing)->assertNotFound();
    }

    public function test_unpublished_listing_does_not_reveal(): void
    {
        $listing = $this->listing(['status' => ListingStatus::Draft, 'published_at' => null]);

        $this->reveal($this->buyer(), $listing)->assertNotFound();
    }

    public function test_account_limit_counts_distinct_listings_per_hour(): void
    {
        $buyer = $this->buyer();
        $limit = SellerPhoneRevealService::PER_ACCOUNT_PER_HOUR;
        $listings = collect(range(1, $limit + 1))->map(fn () => $this->listing());

        foreach ($listings->take($limit) as $i => $listing) {
            // У каждого покупателя свой адрес, чтобы сработал лимит учётки, а не адреса.
            $this->reveal($buyer, $listing, '198.51.100.'.($i % 2))->assertOk();
        }
        // Повтор уже раскрытого номера лимит не тратит.
        $this->reveal($buyer, $listings->first(), '198.51.100.1')->assertOk();

        $this->reveal($buyer, $listings->last(), '198.51.100.1')
            ->assertStatus(429)
            ->assertJsonPath('message', 'Слишком много номеров за час. Попробуйте позже.');

        $this->travel(61)->minutes();
        $this->reveal($buyer, $listings->last(), '198.51.100.1')->assertOk();
    }

    public function test_address_limit_counts_across_accounts(): void
    {
        $limit = SellerPhoneRevealService::PER_ADDRESS_PER_HOUR;
        $ip = '192.0.2.77';
        $listings = collect(range(1, $limit + 1))->map(fn () => $this->listing());

        foreach ($listings->take($limit) as $i => $listing) {
            // Новая учётка на каждые десять номеров — лимит учётки не мешает.
            if ($i % 10 === 0) {
                $buyer = $this->buyer();
            }
            $this->reveal($buyer, $listing, $ip)->assertOk();
        }

        $this->reveal($this->buyer(), $listings->last(), $ip)->assertStatus(429);
        $this->reveal($this->buyer(), $listings->last(), '192.0.2.78')->assertOk();
    }

    public function test_create_accepts_show_phone_and_defaults_to_on(): void
    {
        $this->assertTrue($this->listing()->fresh()->show_phone);
    }
}
