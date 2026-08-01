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
        SystemSetting::query()->create([
            'key' => 'feature.listing_payment_enabled',
            'value' => ['enabled' => false],
            'group' => 'feature',
        ]);

        SystemSetting::query()->create([
            'key' => 'moderation_auto_publish',
            'value' => ['enabled' => true],
            'group' => 'moderation',
        ]);

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
        SystemSetting::query()->create([
            'key' => 'feature.listing_payment_enabled',
            'value' => ['enabled' => false],
            'group' => 'feature',
        ]);

        SystemSetting::query()->create([
            'key' => 'moderation_auto_publish',
            'value' => ['enabled' => false],
            'group' => 'moderation',
        ]);

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
        SystemSetting::query()->create([
            'key' => 'feature.listing_payment_enabled',
            'value' => ['enabled' => false],
            'group' => 'feature',
        ]);

        SystemSetting::query()->create([
            'key' => 'moderation_auto_publish',
            'value' => ['enabled' => true],
            'group' => 'moderation',
        ]);

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

        SystemSetting::query()
            ->where('key', 'moderation_auto_publish')
            ->update(['value' => ['enabled' => false]]);

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

    public function test_published_listing_update_stays_published_when_auto_publish_enabled(): void
    {
        SystemSetting::query()->create([
            'key' => 'feature.listing_payment_enabled',
            'value' => ['enabled' => false],
            'group' => 'feature',
        ]);

        SystemSetting::query()->create([
            'key' => 'moderation_auto_publish',
            'value' => ['enabled' => true],
            'group' => 'moderation',
        ]);

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
            ->assertJsonPath('data.status', 'published');

        $this->getJson('/api/v1/listings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Изменённое объявление');
    }

    public function test_listing_publish_requires_credit_when_payment_flag_enabled(): void
    {
        SystemSetting::query()->create([
            'key' => 'feature.listing_payment_enabled',
            'value' => ['enabled' => true],
            'group' => 'feature',
        ]);

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
}
