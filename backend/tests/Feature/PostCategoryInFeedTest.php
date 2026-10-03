<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Запись садится только в направление из дерева ленты.
 *
 * Флаги `in_feed / in_listings / in_communities` — здешний способ сказать
 * «эта категория не для записей»: узлы, импортированные из торгового дерева и
 * из дерева сообществ, получают `in_feed => false`. На пути записи этого
 * флага не проверял никто, а id торгового узла отдаётся наружу в
 * `GET /api/v1/categories/*`. Запись с ним оказывалась в направлении,
 * которого в дереве ленты нет: в фильтре недостижима, в общей ленте видна.
 *
 * Это порча таксономии, не утечка, — но лечится одной строкой правила.
 */
class PostCategoryInFeedTest extends TestCase
{
    use RefreshDatabase;

    /**
     * `subscription_exempt` — чтобы отказ пришёл от проверки направления, а
     * не от платного доступа: композер ленты закрыт `RequiresSubscription`.
     */
    private function автор(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'subscription_exempt' => true,
        ]);
    }

    private function направление(bool $inFeed): PostCategory
    {
        return PostCategory::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => $inFeed ? 'Авиация' : 'Наборы (из каталога)',
            'slug' => $inFeed ? 'aviation-'.Str::random(6) : 'kits-'.Str::random(6),
            'is_active' => true,
            'in_feed' => $inFeed,
        ]);
    }

    public function test_a_category_outside_the_feed_tree_is_refused(): void
    {
        $user = $this->автор();
        $чужое = $this->направление(false);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Запись не в своём дереве',
                'body' => 'Должна быть отклонена.',
                'category_id' => $чужое->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('category_id');
    }

    public function test_a_feed_category_still_works(): void
    {
        $user = $this->автор();
        $своё = $this->направление(true);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Обычная запись',
                'body' => 'Должна создаться.',
                'category_id' => $своё->id,
            ])
            ->assertCreated();
    }

    public function test_editing_cannot_move_a_post_out_of_the_feed_tree(): void
    {
        $user = $this->автор();
        $своё = $this->направление(true);
        $чужое = $this->направление(false);

        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', [
                'title' => 'Обычная запись',
                'body' => 'Текст.',
                'category_id' => $своё->id,
            ])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/v1/posts/'.$uuid, ['category_id' => $чужое->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('category_id');
    }
}
