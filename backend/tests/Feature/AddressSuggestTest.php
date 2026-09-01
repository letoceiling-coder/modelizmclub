<?php

namespace Tests\Feature;

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

    public function test_nominatim_results_are_proxied(): void
    {
        Cache::flush();
        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                ['display_name' => 'Невский проспект, Санкт-Петербург, Россия'],
                ['display_name' => 'Невский, Ленинградская область, Россия'],
            ], 200),
        ]);

        $this->getJson('/api/v1/geo/address-suggest?q='.urlencode('Невский проспект'))
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Невский проспект, Санкт-Петербург, Россия')
            ->assertJsonPath('data.1.label', 'Невский, Ленинградская область, Россия');
    }
}
