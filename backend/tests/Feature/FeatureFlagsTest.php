<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeatureFlagsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_feature_flags_reflect_communities_toggle(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => false], 'group' => 'features'],
        );

        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.communities_enabled', false);

        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );

        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.communities_enabled', true);
    }

    public function test_public_feature_flags_reviews_default_true_and_toggle(): void
    {
        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.reviews_enabled', true);

        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.reviews_enabled'],
            ['value' => ['enabled' => false], 'group' => 'features'],
        );

        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.reviews_enabled', false);
    }

    public function test_communities_api_is_hidden_when_feature_disabled(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => false], 'group' => 'features'],
        );

        $this->getJson('/api/v1/communities')->assertNotFound();

        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );

        $this->getJson('/api/v1/communities')->assertOk();
    }
}
