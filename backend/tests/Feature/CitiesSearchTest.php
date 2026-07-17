<?php

namespace Tests\Feature;

use App\Models\City;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CitiesSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_city_search_sa_includes_saratov_samara_and_saint_petersburg(): void
    {
        $response = $this->getJson('/api/v1/cities?q='.urlencode('Са'))
            ->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();

        $this->assertContains('Саратов', $names);
        $this->assertContains('Самара', $names);
        $this->assertContains('Санкт-Петербург', $names);
    }

    public function test_city_directory_has_major_cities_beyond_initial_fifteen(): void
    {
        $this->assertTrue(City::query()->where('slug', 'saratov')->exists());
        $this->assertGreaterThanOrEqual(50, City::query()->count());
    }
}
