<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Support\FooterContacts;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBootstrapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_public_bootstrap_nests_existing_payloads(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.communities_enabled'],
            ['value' => ['enabled' => true], 'group' => 'features'],
        );
        SystemSetting::query()->updateOrCreate(
            ['key' => FooterContacts::SETTING_KEY],
            [
                'group' => 'footer',
                'value' => [
                    'email' => 'support@modelizmclub.ru',
                    'social' => [['label' => 'VK', 'url' => 'https://vk.com/modelizm']],
                ],
            ],
        );

        $this->getJson('/api/v1/public/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.feature_flags.communities_enabled', true)
            ->assertJsonPath('data.feature_flags.reviews_enabled', true)
            ->assertJsonPath('data.footer_contacts.email', 'support@modelizmclub.ru')
            ->assertJsonStructure([
                'data' => [
                    'feature_flags',
                    'branding' => ['header_size', 'footer_size'],
                    'footer_contacts',
                    'footer_links',
                    'landing_blocks' => ['sections'],
                    'landing_stats' => ['users', 'communities', 'listing_categories'],
                    'stats' => ['first_hundred', 'referral'],
                    'feed_guest_access',
                    'icon_overrides',
                    'landing_faq',
                    'post_categories',
                    'listing_categories',
                ],
            ]);
    }
}
