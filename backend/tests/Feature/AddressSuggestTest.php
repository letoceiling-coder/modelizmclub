<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AddressSuggestTest extends TestCase
{
    use RefreshDatabase;

    public function test_short_query_returns_empty(): void
    {
        $this->getJson('/api/v1/geo/address-suggest?q=сп')
            ->assertOk()
            ->assertJson(['data' => []]);
    }

    public function test_nominatim_results_are_compact_city_street_labels(): void
    {
        Cache::flush();
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                [
                    'addresstype' => 'road',
                    'name' => 'улица Карла Маркса',
                    'display_name' => 'улица Карла Маркса, Западный округ, Краснодар, Краснодарский край, Россия',
                    'address' => [
                        'road' => 'улица Карла Маркса',
                        'city' => 'Краснодар',
                        'state' => 'Краснодарский край',
                    ],
                ],
                [
                    'addresstype' => 'road',
                    'name' => 'улица Карла Маркса',
                    'display_name' => 'улица Карла Маркса, Прикубанский округ, Краснодар, Россия',
                    'address' => [
                        'road' => 'улица Карла Маркса',
                        'city' => 'Краснодар',
                    ],
                ],
                [
                    'addresstype' => 'hamlet',
                    'name' => 'Карла Маркса',
                    'display_name' => 'Карла Маркса, Крымский район, Краснодарский край, Россия',
                    'address' => [
                        'hamlet' => 'Карла Маркса',
                        'county' => 'Крымский район',
                        'state' => 'Краснодарский край',
                    ],
                ],
            ], 200),
        ]);

        $this->getJson('/api/v1/geo/address-suggest?q='.urlencode('Краснодар, Карла'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.label', 'Краснодар, улица Карла Маркса');
    }

    public function test_city_param_is_prepended_and_filters_other_settlements(): void
    {
        Cache::flush();
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                [
                    'addresstype' => 'road',
                    'name' => 'улица Карла Маркса',
                    'address' => [
                        'road' => 'улица Карла Маркса',
                        'city' => 'Краснодар',
                    ],
                ],
                [
                    'addresstype' => 'road',
                    'name' => 'улица Карла Либкнехта',
                    'address' => [
                        'road' => 'улица Карла Либкнехта',
                        'city' => 'Ростов-на-Дону',
                    ],
                ],
            ], 200),
        ]);

        $this->getJson('/api/v1/geo/address-suggest?q='.urlencode('Карла').'&city='.urlencode('Краснодар'))
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Краснодар, улица Карла Маркса')
            ->assertJsonMissing(['label' => 'Ростов-на-Дону, улица Карла Либкнехта']);

        Http::assertSent(function ($request): bool {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            return str_contains($request->url(), 'nominatim.openstreetmap.org')
                && ($query['q'] ?? '') === 'Краснодар, Карла'
                && ($query['addressdetails'] ?? '') === '1';
        });
    }

    public function test_house_number_is_appended(): void
    {
        Cache::flush();
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                [
                    'addresstype' => 'house',
                    'name' => '12',
                    'address' => [
                        'house_number' => '12',
                        'road' => 'улица Красная',
                        'city' => 'Краснодар',
                    ],
                ],
            ], 200),
        ]);

        $this->getJson('/api/v1/geo/address-suggest?q='.urlencode('Краснодар, Красная 12'))
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Краснодар, улица Красная, 12');
    }

    public function test_recent_pickup_addresses_return_last_three_unique(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $category = ListingCategory::query()->create([
            'name' => 'Наборы',
            'slug' => 'kits-pickup',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->listing($user, $category, 'Краснодар, улица Красная, 1', now()->subDays(4));
        $this->listing($user, $category, 'Краснодар, улица Красная, 1', now()->subDays(3));
        $this->listing($user, $category, 'Краснодар, улица Северная, 8', now()->subDays(2));
        $this->listing($user, $category, 'Краснодар, улица Карла Маркса, 10', now()->subDay());
        $this->listing($other, $category, 'Москва, Тверская, 1', now());

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/pickup-addresses')
            ->assertOk()
            ->assertJsonPath('data', [
                'Краснодар, улица Карла Маркса, 10',
                'Краснодар, улица Северная, 8',
                'Краснодар, улица Красная, 1',
            ]);
    }

    public function test_recent_pickup_addresses_require_auth(): void
    {
        $this->getJson('/api/v1/users/me/pickup-addresses')->assertUnauthorized();
    }

    private function listing(User $user, ListingCategory $category, string $address, $updatedAt): Listing
    {
        $listing = Listing::query()->create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'title' => 'Модель '.$address,
            'slug' => 'pickup-'.uniqid(),
            'description' => 'Описание модели для самовывоза',
            'price_cents' => 10000,
            'status' => ListingStatus::Published,
            'pickup_address' => $address,
            'published_at' => $updatedAt,
        ]);
        Listing::query()->whereKey($listing->id)->update([
            'created_at' => $updatedAt,
            'updated_at' => $updatedAt,
        ]);

        return $listing->refresh();
    }
}
