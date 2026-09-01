<?php

namespace Tests\Feature;

use App\Models\ListingCategory;
use App\Models\User;
use Database\Seeders\DeliveryMethodsSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryMethodsCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(DeliveryMethodsSeeder::class);
    }

    public function test_public_delivery_methods_lists_active_providers(): void
    {
        $this->getJson('/api/v1/public/delivery-methods')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'cdek')
            ->assertJsonFragment(['name' => 'Почта России'])
            ->assertJsonFragment(['name' => 'Ozon'])
            ->assertJsonFragment(['name' => 'Самовывоз'])
            ->assertJsonMissing(['name' => 'Боксберри'])
            ->assertJsonMissing(['code' => 'boxberry']);
    }

    public function test_listing_rejects_unknown_delivery_method(): void
    {
        $user = User::factory()->create();
        $categoryId = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits',
            'sort_order' => 1,
            'is_active' => true,
        ])->id;

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/listings', [
                'title' => 'Test listing',
                'description' => str_repeat('Description ', 10),
                'category_id' => $categoryId,
                'delivery_methods' => ['Unknown Carrier'],
                'publish' => false,
            ])
            ->assertStatus(422);
    }
}
