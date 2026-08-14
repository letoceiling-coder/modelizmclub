<?php

namespace Tests\Feature;

use App\Models\FaqArticle;
use App\Models\FaqCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminFaqTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_faq_can_filter_by_category_slug(): void
    {
        $landing = FaqCategory::query()->create([
            'slug' => 'landing',
            'name' => 'Лендинг',
            'sort_order' => 5,
            'is_active' => true,
        ]);
        $general = FaqCategory::query()->create([
            'slug' => 'general',
            'name' => 'Общие',
            'sort_order' => 10,
            'is_active' => true,
        ]);

        FaqArticle::query()->create([
            'category_id' => $landing->id,
            'question' => 'Landing Q',
            'answer' => 'Landing A',
            'sort_order' => 10,
            'is_active' => true,
        ]);
        FaqArticle::query()->create([
            'category_id' => $general->id,
            'question' => 'General Q',
            'answer' => 'General A',
            'sort_order' => 10,
            'is_active' => true,
        ]);

        $this->getJson('/api/v1/public/faq?category=landing')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'landing')
            ->assertJsonPath('data.0.articles.0.question', 'Landing Q');
    }

    public function test_admin_can_manage_faq_articles(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $category = FaqCategory::query()->create([
            'slug' => 'landing',
            'name' => 'Лендинг',
            'sort_order' => 5,
            'is_active' => true,
        ]);

        $create = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/faq/articles', [
                'category_id' => $category->id,
                'question' => 'New?',
                'answer' => 'Yes.',
                'sort_order' => 10,
                'is_active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.question', 'New?');

        $articleId = $create->json('data.id');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/faq/articles/{$articleId}", [
                'category_id' => $category->id,
                'question' => 'Updated?',
                'answer' => 'Sure.',
                'sort_order' => 20,
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.question', 'Updated?')
            ->assertJsonPath('data.is_active', false);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/v1/admin/faq/articles/{$articleId}")
            ->assertOk();

        $this->assertDatabaseMissing('faq_articles', ['id' => $articleId]);
    }
}
