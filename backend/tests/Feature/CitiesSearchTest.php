<?php

namespace Tests\Feature;

use App\Models\City;
use App\Support\RussianCitiesImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CitiesSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RussianCitiesImporter::import(flushCache: false);
    }

    public function test_city_search_sa_includes_saratov_samara_and_saint_petersburg(): void
    {
        $response = $this->getJson('/api/v1/cities?q='.urlencode('Са'))
            ->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();

        $this->assertContains('Саратов', $names);
        $this->assertContains('Самара', $names);
        $this->assertContains('Санкт-Петербург', $names);
    }

    public function test_city_search_seva_includes_sevastopol(): void
    {
        $response = $this->getJson('/api/v1/cities?q='.urlencode('сева'))
            ->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();

        $this->assertContains('Севастополь', $names);
    }

    public function test_city_directory_includes_all_russian_cities(): void
    {
        $this->assertTrue(City::query()->where('slug', 'sevastopol')->exists());
        $this->assertTrue(City::query()->where('slug', 'simferopol')->exists());
        $this->assertGreaterThanOrEqual(1100, City::query()->count());
    }

    public function test_empty_city_query_returns_popular_cities_only(): void
    {
        $response = $this->getJson('/api/v1/cities')
            ->assertOk();

        $this->assertLessThanOrEqual(30, count($response->json('data')));
        $this->assertSame('Москва', $response->json('data.0.name'));
    }
}
