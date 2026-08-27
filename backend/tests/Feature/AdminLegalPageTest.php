<?php

namespace Tests\Feature;

use App\Enums\LegalPageStatus;
use App\Models\LegalPage;
use App\Models\User;
use Database\Seeders\LegalComplianceSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminLegalPageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(LegalComplianceSeeder::class);
    }

    public function test_admin_can_update_and_restore_legal_page_revision(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $page = LegalPage::query()->where('slug', 'safe-deal')->firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/legal-pages/{$page->id}", [
                'slug' => 'safe-deal',
                'title' => 'Правила безопасной сделки (черновик)',
                'meta_description' => 'Черновик описания',
                'content_html' => '<h2>Черновик</h2><p>Новая редакция.</p>',
            ])
            ->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.status', LegalPageStatus::Draft->value);

        $this->assertDatabaseHas('legal_page_revisions', [
            'legal_page_id' => $page->id,
            'version' => 1,
        ]);

        $revisionId = (int) $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/admin/legal-pages/{$page->id}/revisions")
            ->assertOk()
            ->json('data.0.id');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/legal-pages/{$page->id}/revisions/{$revisionId}/restore")
            ->assertOk()
            ->assertJsonPath('data.version', 3)
            ->assertJsonPath('data.title', 'Правила безопасной сделки');
    }

    public function test_admin_markdown_preview_and_save(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $html = (string) $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/legal-pages/preview-markdown', [
                'content_md' => "## Заголовок\n\nТекст **жирный**.",
            ])
            ->assertOk()
            ->json('data.content_html');
        $this->assertStringContainsString('Заголовок', $html);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/legal-pages', [
                'slug' => 'test-md',
                'title' => 'Markdown page',
                'content_md' => "## Hello\n\nWorld",
            ])
            ->assertCreated()
            ->assertJsonPath('data.slug', 'test-md');

        $created = LegalPage::query()->where('slug', 'test-md')->firstOrFail();
        $this->assertStringContainsString('<h2>Hello</h2>', $created->content_html);
    }
}
