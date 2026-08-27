<?php

namespace Tests\Feature;

use App\Enums\LegalPageStatus;
use App\Models\RulePage;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Database\Seeders\RulesHubSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class RulesHubTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(RulesHubSeeder::class);
    }

    public function test_hub_lists_four_published_documents(): void
    {
        $this->getJson('/api/v1/rules')
            ->assertOk()
            ->assertJsonPath('data.title', 'Правила Моделизма')
            ->assertJsonCount(4, 'data.documents')
            ->assertJsonFragment(['slug' => 'terms', 'href' => '/rules/terms'])
            ->assertJsonFragment(['slug' => 'ads', 'href' => '/rules/ads'])
            ->assertJsonFragment(['slug' => 'services-offer', 'href' => '/rules/services-offer'])
            ->assertJsonFragment(['slug' => 'safe-deal', 'href' => '/rules/safe-deal']);
    }

    public function test_each_document_has_numbered_sections_and_revision_date(): void
    {
        foreach (['terms', 'ads', 'services-offer', 'safe-deal'] as $slug) {
            $response = $this->getJson('/api/v1/rules/'.$slug)
                ->assertOk()
                ->assertJsonPath('data.slug', $slug);

            $sections = $response->json('data.sections');
            $this->assertIsArray($sections);
            $this->assertGreaterThanOrEqual(3, count($sections));
            $this->assertNotEmpty($response->json('data.published_at'));
            $this->assertNotEmpty($response->json('data.title'));

            $html = implode('', array_map(fn ($s) => (string) ($s['content'] ?? ''), $sections));
            $this->assertStringNotContainsString('lorem ipsum', mb_strtolower($html));
            $this->assertStringContainsString('1.1.', $html);
        }
    }

    public function test_terms_and_offer_include_requisites(): void
    {
        foreach (['terms', 'services-offer'] as $slug) {
            $types = collect($this->getJson('/api/v1/rules/'.$slug)->json('data.sections'))
                ->pluck('type')
                ->all();
            $this->assertContains('requisites', $types);
            $this->assertContains('intro', $types);
        }
    }

    public function test_unpublished_or_unknown_slug_returns_404(): void
    {
        $this->getJson('/api/v1/rules/unknown-doc')->assertNotFound();

        $page = RulePage::query()->where('slug', 'ads')->firstOrFail();
        $page->update(['status' => LegalPageStatus::Draft, 'published_at' => null]);
        Cache::flush();

        $this->getJson('/api/v1/rules/ads')->assertNotFound();
    }

    public function test_admin_can_reorder_publish_and_restore_sections(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $page = RulePage::query()->where('slug', 'terms')->firstOrFail();
        $originalTitle = $page->title;

        $sections = $page->sections->map(fn ($s, $i) => [
            'type' => $s->type->value,
            'title' => $s->title,
            'content' => $s->content,
            'position' => $i,
            'is_visible' => true,
        ])->all();
        $sections[0]['content'] = '<p>Черновик вступления.</p>';

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/rule-pages/{$page->id}", [
                'slug' => 'terms',
                'title' => 'Условия (черновик)',
                'seo_title' => 'Черновик',
                'summary' => 'Черновик',
                'sections' => $sections,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', LegalPageStatus::Draft->value)
            ->assertJsonPath('data.title', 'Условия (черновик)');

        $this->getJson('/api/v1/rules/terms')->assertNotFound();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/rule-pages/{$page->id}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', LegalPageStatus::Published->value);

        $this->getJson('/api/v1/rules/terms')
            ->assertOk()
            ->assertJsonPath('data.title', 'Условия (черновик)');

        $revisions = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/admin/rule-pages/{$page->id}/revisions")
            ->assertOk()
            ->json('data');
        $revisionId = (int) collect($revisions)->firstWhere('title', $originalTitle)['id'];

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/rule-pages/{$page->id}/revisions/{$revisionId}/restore")
            ->assertOk()
            ->assertJsonPath('data.status', LegalPageStatus::Draft->value)
            ->assertJsonPath('data.title', $originalTitle);

        $guest = User::factory()->create(['role' => 'user']);
        $this->actingAs($guest, 'sanctum')
            ->getJson('/api/v1/admin/rule-pages')
            ->assertForbidden();
    }

    public function test_admin_can_duplicate_rule_page(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $page = RulePage::query()->where('slug', 'ads')->firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/rule-pages/{$page->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.slug', 'ads-copy')
            ->assertJsonPath('data.status', LegalPageStatus::Draft->value);

        $this->getJson('/api/v1/rules/ads-copy')->assertNotFound();
    }
}
