<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PostCategory;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Создание записи и уровень `feed.compose.open` из карты доступа.
 *
 * Интерфейс закрывал «Что у вас нового?» окном подписки, а сервер пропускал:
 * на проде 19.09 учётка без подписки создала и опубликовала запись прямым
 * запросом (201, затем 200 pending_moderation). Карта настраивается в
 * админке, поэтому сервер читает тот же уровень, что и интерфейс: при
 * `subscription` — нужна подписка, при `auth` — хватает входа.
 */
class PostSubscriptionGateTest extends TestCase
{
    use RefreshDatabase;

    private PostCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        config(['feed.auto_publish' => true]);
        $this->category = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'is_active' => true,
        ]);
    }

    private function verifiedUser(array $attrs = []): User
    {
        $user = User::factory()->create(array_merge([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $attrs));
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Автор',
            'slug' => 'author-'.uniqid(),
        ]);

        return $user;
    }

    private function subscriber(): User
    {
        $user = $this->verifiedUser();
        $plan = SubscriptionPlan::query()->create([
            'slug' => 'month-'.uniqid(),
            'name' => 'Месяц',
            'price_cents' => 9900,
            'period_days' => 30,
            'sort_order' => 1,
            'is_active' => true,
        ]);
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
        ]);
        $this->recordPaidPlanPayment($user, (int) $plan->id, (int) $plan->price_cents);

        return $user;
    }

    private function payload(): array
    {
        return [
            'title' => 'Проба подписки',
            'body' => 'Текст записи.',
            'category_id' => $this->category->id,
        ];
    }

    public function test_without_subscription_cannot_create_post_when_tier_is_subscription(): void
    {
        $this->setComposeTier('subscription');

        $this->actingAs($this->verifiedUser(), 'sanctum')
            ->postJson('/api/v1/posts', $this->payload())
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_without_subscription_cannot_publish_or_schedule_existing_draft(): void
    {
        // Черновик мог остаться со времён, когда подписка была или правило
        // было мягче. Опубликовать его — то же создание контента.
        $this->setComposeTier('auth');
        $user = $this->verifiedUser();
        $uuid = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/posts', $this->payload())
            ->assertCreated()
            ->json('data.uuid');

        $this->setComposeTier('subscription');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/schedule", ['scheduled_at' => now()->addDay()->toIso8601String()])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_subscriber_can_create_post(): void
    {
        $this->setComposeTier('subscription');

        $this->actingAs($this->subscriber(), 'sanctum')
            ->postJson('/api/v1/posts', $this->payload())
            ->assertCreated();
    }

    public function test_staff_without_subscription_can_create_post(): void
    {
        // Как в интерфейсе: сотрудник считается подписчиком (isStaffUser).
        $this->setComposeTier('subscription');

        foreach ([UserRole::Moderator, UserRole::Owner] as $role) {
            $this->actingAs($this->verifiedUser(['role' => $role]), 'sanctum')
                ->postJson('/api/v1/posts', $this->payload())
                ->assertCreated();
        }
    }

    public function test_admin_can_relax_the_tier_to_auth(): void
    {
        // Карта — единственный источник правила: если в админке поставили
        // «вошедшим», сервер не должен требовать больше, чем интерфейс.
        $this->setComposeTier('auth');

        $this->actingAs($this->verifiedUser(), 'sanctum')
            ->postJson('/api/v1/posts', $this->payload())
            ->assertCreated();
    }

    public function test_community_post_is_gated_by_the_same_tier(): void
    {
        // Стена сообщества шлёт тот же POST /posts, только с community_id.
        $this->setComposeTier('subscription');

        $this->actingAs($this->verifiedUser(), 'sanctum')
            ->postJson('/api/v1/posts', $this->payload() + ['community_id' => 999999])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_repost_follows_its_own_tier(): void
    {
        // Репост с текстом публикуется сразу — это тоже создание контента.
        // Ключ у него свой, `feed.post.repost`, и сервер читает его из карты.
        $author = $this->subscriber();
        $this->setComposeTier('subscription');
        $uuid = $this->actingAs($author, 'sanctum')
            ->postJson('/api/v1/posts', $this->payload())
            ->assertCreated()
            ->json('data.uuid');
        $this->actingAs($author, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/publish")
            ->assertOk();

        $reader = $this->verifiedUser();
        $this->setActionTier('feed.post.repost', 'subscription');
        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/repost", ['body' => 'Смотрите'])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');

        $this->setActionTier('feed.post.repost', 'auth');
        $this->actingAs($reader, 'sanctum')
            ->postJson("/api/v1/posts/{$uuid}/repost", ['body' => 'Смотрите'])
            ->assertCreated();
    }
}
