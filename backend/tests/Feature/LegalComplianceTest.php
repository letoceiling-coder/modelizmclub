<?php

namespace Tests\Feature;

use App\Models\ConsentLog;
use App\Models\User;
use Database\Seeders\LegalComplianceSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegalComplianceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(LegalComplianceSeeder::class);
    }

    public function test_public_legal_page_rules_is_published(): void
    {
        $this->getJson('/api/v1/legal/rules')
            ->assertOk()
            ->assertJsonPath('data.slug', 'rules')
            ->assertJsonStructure(['data' => ['title', 'content_html', 'version']]);
    }

    public function test_footer_links_are_grouped(): void
    {
        $this->getJson('/api/v1/footer-links')
            ->assertOk()
            ->assertJsonStructure(['data' => ['legal']]);
    }

    public function test_public_info_page_about_is_published(): void
    {
        $this->getJson('/api/v1/legal/about')
            ->assertOk()
            ->assertJsonPath('data.slug', 'about')
            ->assertJsonStructure(['data' => ['title', 'content_html', 'version']]);
    }

    public function test_vtb_and_how_it_works_pages_are_published(): void
    {
        foreach (['payment', 'refund', 'how-it-works', 'safe-deal'] as $slug) {
            $response = $this->getJson('/api/v1/legal/'.$slug)
                ->assertOk()
                ->assertJsonPath('data.slug', $slug);

            $html = (string) $response->json('data.content_html');
            $this->assertNotSame('', trim($html));
        }
    }

    public function test_safe_deal_rules_are_published_with_seo_fields(): void
    {
        $this->getJson('/api/v1/legal/safe-deal')
            ->assertOk()
            ->assertJsonPath('data.slug', 'safe-deal')
            ->assertJsonPath('data.title', 'Правила безопасной сделки')
            ->assertJsonStructure(['data' => ['title', 'content_html', 'meta_description', 'version']]);

        $this->getJson('/api/v1/footer-links')
            ->assertOk()
            ->assertJsonFragment(['target_value' => '/safe-deal', 'label' => 'Безопасная сделка']);
    }

    public function test_register_requires_terms_and_privacy_consents(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'email' => 'legal-test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'registration_track' => 'community',
            'display_name' => 'Legal Test',
            'accept_terms' => false,
            'accept_privacy' => false,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['accept_terms', 'accept_privacy']);
    }

    public function test_register_logs_consents_when_accepted(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'email' => 'legal-ok@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'registration_track' => 'community',
            'display_name' => 'Legal Ok',
            'accept_terms' => true,
            'accept_privacy' => true,
            'accept_ads' => false,
        ])->assertCreated();

        $user = User::where('email', 'legal-ok@example.com')->first();
        $this->assertNotNull($user);

        $this->assertDatabaseHas('consent_logs', [
            'user_id' => $user->id,
            'consent_type' => 'terms',
            'status' => 'granted',
        ]);
        $this->assertDatabaseHas('consent_logs', [
            'user_id' => $user->id,
            'consent_type' => 'privacy',
            'status' => 'granted',
        ]);
        $this->assertDatabaseHas('consent_logs', [
            'user_id' => $user->id,
            'consent_type' => 'ads',
            'status' => 'revoked',
        ]);
    }
}
