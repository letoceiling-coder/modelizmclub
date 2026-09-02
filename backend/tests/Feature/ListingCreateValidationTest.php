<?php

namespace Tests\Feature;

use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListingCreateValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private int $categoryId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->user = User::factory()->create();
        $this->categoryId = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits',
            'sort_order' => 1,
            'is_active' => true,
        ])->id;
    }

    /** @param array<string, mixed> $value */
    private function upsertSetting(string $key, array $value, string $group): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => $group],
        );
    }

    public function test_oversized_price_returns_russian_message_not_validation_key(): void
    {
        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Тестовое объявление',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 999_999_999_999_999,
                'publish' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['price_cents'])
            ->assertJsonFragment(['price_cents' => ['Цена слишком большая. Максимум — 999 999 999 ₽.']]);
    }

    public function test_listing_publishes_for_free_when_payment_flag_disabled(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => false], 'feature');
        $this->upsertSetting('moderation_auto_publish', ['enabled' => true], 'moderation');

        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Бесплатное объявление',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 10_000,
                'publish' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published');
    }

    public function test_listing_goes_to_moderation_when_auto_publish_disabled(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => false], 'feature');
        $this->upsertSetting('moderation_auto_publish', ['enabled' => false], 'moderation');

        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Объявление на модерации',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 10_000,
                'publish' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending_moderation');

        $this->assertDatabaseHas('moderation_queue', [
            'queue' => 'listings',
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_published_listing_update_re_moderates_when_auto_publish_disabled(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => false], 'feature');
        $this->upsertSetting('moderation_auto_publish', ['enabled' => true], 'moderation');

        $created = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Опубликованное объявление',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 10_000,
                'publish' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published');

        $uuid = $created->json('data.uuid');

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->upsertSetting('moderation_auto_publish', ['enabled' => false], 'moderation');

        $this->actingAs($this->user, 'sanctum')
            ->patchJson("/api/v1/listings/{$uuid}", [
                'title' => 'Изменённое объявление',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_moderation');

        $this->assertDatabaseHas('moderation_queue', [
            'queue' => 'listings',
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_published_listing_update_re_moderates_even_when_auto_publish_enabled(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => false], 'feature');
        $this->upsertSetting('moderation_auto_publish', ['enabled' => true], 'moderation');

        $created = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Опубликованное объявление',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 10_000,
                'publish' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published');

        $uuid = $created->json('data.uuid');

        $this->actingAs($this->user, 'sanctum')
            ->patchJson("/api/v1/listings/{$uuid}", [
                'title' => 'Изменённое объявление',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_moderation');

        $this->assertDatabaseHas('moderation_queue', [
            'queue' => 'listings',
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_listing_publish_requires_credit_when_payment_flag_enabled(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => true], 'feature');

        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Платное объявление',
                'description' => str_repeat('Описание объявления. ', 5),
                'category_id' => $this->categoryId,
                'price_cents' => 10_000,
                'publish' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['publish']);
    }

    public function test_create_reuses_title_when_previous_listing_was_deleted(): void
    {
        $this->upsertSetting('feature.listing_payment_enabled', ['enabled' => false], 'feature');
        $this->upsertSetting('moderation_auto_publish', ['enabled' => true], 'moderation');

        $payload = [
            'title' => 'Test',
            'description' => str_repeat('Описание объявления. ', 5),
            'category_id' => $this->categoryId,
            'price_cents' => 10_000,
            'publish' => true,
        ];

        $created = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', $payload)
            ->assertCreated();

        $uuid = $created->json('data.uuid');
        $this->actingAs($this->user, 'sanctum')
            ->deleteJson("/api/v1/listings/{$uuid}")
            ->assertOk();

        $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/v1/listings', $payload)
            ->assertCreated()
            ->assertJsonPath('data.title', 'Test');
    }
}
