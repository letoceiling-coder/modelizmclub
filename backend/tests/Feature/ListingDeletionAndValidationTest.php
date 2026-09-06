<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\DeliveryMethod;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Удаление объявления, проверки при публикации и человеческий текст ошибок.
 */
class ListingDeletionAndValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );

        DeliveryMethod::query()->firstOrCreate(
            ['code' => 'cdek'],
            ['name' => 'СДЭК', 'is_active' => true, 'is_integrated' => true, 'sort_order' => 1],
        );
        DeliveryMethod::query()->firstOrCreate(
            ['code' => 'pickup'],
            ['name' => 'Самовывоз', 'is_active' => true, 'is_integrated' => false, 'sort_order' => 5],
        );
    }

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function category(): ListingCategory
    {
        return ListingCategory::query()->create([
            'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
        ]);
    }

    /** @param  list<string>  $methods */
    private function seedListing(User $seller, array $methods = ['Самовывоз']): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $this->category()->id,
            'title' => 'Модель на продажу',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
            'delivery_methods' => $methods,
        ]);
    }

    // ── Пункт 9: город отправки ──────────────────────────────────────────

    public function test_cdek_listing_without_an_origin_city_is_rejected_at_creation(): void
    {
        $seller = $this->seedUser('seller');

        // Раньше такое объявление публиковалось, а отказ «Продавец не указал
        // город отправки» получал покупатель уже на расчёте сделки.
        $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Набор',
                'description' => 'Описание',
                'category_id' => $this->category()->id,
                'price_cents' => 100000,
                'delivery_methods' => ['СДЭК'],
                'package_size' => 'm',
                'accept_rules' => true,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['city_id']);
    }

    public function test_pickup_listing_needs_no_origin_city(): void
    {
        $seller = $this->seedUser('seller');

        $this->actingAs($seller, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Набор',
                'description' => 'Описание',
                'category_id' => $this->category()->id,
                'price_cents' => 100000,
                'delivery_methods' => ['Самовывоз'],
                'pickup_address' => 'Москва, у метро',
                'accept_rules' => true,
            ])
            ->assertCreated();
    }

    // ── Пункт 10: удаление объявления ────────────────────────────────────

    public function test_listing_with_a_live_deal_cannot_be_deleted(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated();

        $this->actingAs($seller, 'sanctum')
            ->deleteJson("/api/v1/listings/{$listing->uuid}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['listing']);

        $this->assertNull($listing->fresh()->deleted_at);
    }

    public function test_listing_can_be_deleted_once_the_deal_is_finished(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/confirm")
            ->assertOk();

        $this->actingAs($seller, 'sanctum')
            ->deleteJson("/api/v1/listings/{$listing->uuid}")
            ->assertOk();

        $this->assertNotNull($listing->fresh()->deleted_at);
    }

    public function test_finished_deal_keeps_its_listing_title_after_deletion(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/safe-deals/{$uuid}/confirm")->assertOk();
        $this->actingAs($seller, 'sanctum')->deleteJson("/api/v1/listings/{$listing->uuid}")->assertOk();

        // Мягкое удаление: связь помечена withTrashed.
        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.listing_title', 'Модель на продажу');

        // Жёсткое: заголовок остаётся снимком в самой сделке.
        Listing::withTrashed()->find($listing->id)->forceDelete();

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/safe-deals/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.listing_title', 'Модель на продажу');
    }

    public function test_cancelled_deal_reports_when_it_was_cancelled(): void
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        $payload = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/cancel")
            ->assertOk()
            ->json('data');

        $this->assertSame(SafeDealStatus::Cancelled->value, $payload['status']);
        $this->assertNotNull($payload['cancelled_at'] ?? null, 'дата отмены должна приходить в ответе');
    }

    // ── Пункт 11: сообщения валидации ────────────────────────────────────

    public function test_validation_messages_are_russian_not_raw_keys(): void
    {
        foreach ([
            ['rules' => ['in:avatar,post'], 'value' => 'нечто'],
            ['rules' => ['required'], 'value' => null],
            ['rules' => ['email'], 'value' => 'не почта'],
            ['rules' => ['integer'], 'value' => 'строка'],
            ['rules' => ['uuid'], 'value' => 'не-uuid'],
        ] as $case) {
            $message = Validator::make(['field' => $case['value']], ['field' => $case['rules']])
                ->errors()->first('field');

            $this->assertNotSame('', $message);
            $this->assertStringNotContainsString(
                'validation.',
                $message,
                'наружу не должен уходить ключ перевода: '.json_encode($case['rules']),
            );
        }
    }

    public function test_media_upload_rejects_unknown_purpose_with_a_readable_message(): void
    {
        $user = $this->seedUser('uploader');

        $message = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/media', ['purpose' => 'dispute_evidence'])
            ->assertStatus(422)
            ->json('errors.purpose.0');

        $this->assertStringNotContainsString('validation.', (string) $message);
    }
}
