<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Modules\Feed\Services\PostService;
use Tests\TestCase;

/**
 * Четыре действия, которые до 19.09 требовали подписку только в интерфейсе:
 * вступление в сообщество, подписка на канал, запись в своём канале,
 * звонок. Прямой запрос проходил без неё. Теперь у каждого ключ карты
 * доступа, и сервер читает тот же уровень, что и интерфейс.
 *
 * И планировщик: отложенная запись выходит, только если к сроку у автора
 * всё ещё хватает подписки.
 */
class SocialActionsMapKeysTest extends TestCase
{
    use RefreshDatabase;

    private function person(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function subscriber(): User
    {
        $user = $this->person();
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

    private function community(): Community
    {
        $owner = $this->person();
        $category = CommunityCategory::query()->create([
            'name' => 'Категория',
            'slug' => 'cat-'.Str::random(8),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
        $community = Community::query()->create([
            'category_id' => $category->id,
            'name' => 'Клуб '.Str::random(5),
            'slug' => 'club-'.Str::random(8),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'access_type' => 'open',
            'members_count' => 1,
        ]);
        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        return $community;
    }

    private function channel(User $owner): Channel
    {
        return Channel::create([
            'owner_id' => $owner->id,
            'name' => 'Канал '.uniqid(),
            'slug' => 'channel-'.uniqid(),
            'kind' => 'author',
            'comments_enabled' => true,
        ]);
    }

    private function assertSubscriptionRequired(TestResponse $response): void
    {
        $response->assertForbidden()->assertJsonPath('code', 'subscription_required');
    }

    private function assertNotSubscriptionGated(TestResponse $response): void
    {
        $this->assertNotSame('subscription_required', $response->json('code'), $response->getContent());
        $this->assertNotContains($response->status(), [401, 403], $response->getContent());
    }

    public function test_joining_a_community_needs_no_subscription_by_default_and_follows_the_map(): void
    {
        $community = $this->community();
        $this->assertNotSubscriptionGated(
            $this->actingAs($this->person(), 'sanctum')->postJson("/api/v1/communities/{$community->slug}/join"),
        );

        $this->setActionTier('community.join', 'subscription');
        $this->assertSubscriptionRequired(
            $this->actingAs($this->person(), 'sanctum')->postJson("/api/v1/communities/{$community->slug}/join"),
        );
        $this->assertNotSubscriptionGated(
            $this->actingAs($this->subscriber(), 'sanctum')->postJson("/api/v1/communities/{$community->slug}/join"),
        );
    }

    public function test_leaving_a_community_is_never_gated(): void
    {
        $community = $this->community();
        $member = $this->person();
        $this->actingAs($member, 'sanctum')->postJson("/api/v1/communities/{$community->slug}/join");

        $this->setActionTier('community.join', 'subscription');
        $this->assertNotSubscriptionGated(
            $this->actingAs($member, 'sanctum')->deleteJson("/api/v1/communities/{$community->slug}/leave"),
        );
    }

    /**
     * Ответить на звонок, отклонить, положить трубку и получить токен
     * комнаты может и тот, у кого подписки нет: платит тот, кто звонит.
     */
    public function test_answering_a_call_is_not_gated(): void
    {
        $free = ['api/v1/calls/{uuid}/answer', 'api/v1/calls/{uuid}/reject', 'api/v1/calls/{uuid}/hangup', 'api/v1/calls/livekit/token'];
        foreach (Route::getRoutes() as $route) {
            if (! in_array($route->uri(), $free, true)) {
                continue;
            }
            foreach ($route->gatherMiddleware() as $m) {
                $this->assertFalse(
                    is_string($m) && str_starts_with($m, 'requiresSubscription'),
                    $route->uri().' не должен требовать подписку',
                );
            }
        }
    }

    public function test_subscribing_to_a_channel_needs_no_subscription_by_default_and_follows_the_map(): void
    {
        $channel = $this->channel($this->person());
        $this->assertNotSubscriptionGated(
            $this->actingAs($this->person(), 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/subscribe"),
        );

        $this->setActionTier('channel.subscribe', 'subscription');
        $this->assertSubscriptionRequired(
            $this->actingAs($this->person(), 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/subscribe"),
        );
        // Отписаться можно всегда: закрытый выход — ловушка.
        $this->assertNotSubscriptionGated(
            $this->actingAs($this->person(), 'sanctum')->deleteJson("/api/v1/channels/{$channel->slug}/subscribe"),
        );
    }

    public function test_posting_in_own_channel_needs_a_subscription_by_default(): void
    {
        $owner = $this->person();
        $channel = $this->channel($owner);
        $this->assertSubscriptionRequired(
            $this->actingAs($owner, 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Запись']),
        );
        $this->assertSame(0, DB::table('channel_posts')->count());

        $subscribed = $this->subscriber();
        $own = $this->channel($subscribed);
        $this->assertNotSubscriptionGated(
            $this->actingAs($subscribed, 'sanctum')->postJson("/api/v1/channels/{$own->slug}/posts", ['text' => 'Запись']),
        );

        $this->setActionTier('channel.post.create', 'auth');
        $this->assertNotSubscriptionGated(
            $this->actingAs($owner, 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Запись']),
        );
    }

    public function test_starting_or_inviting_to_a_call_needs_a_subscription_by_default(): void
    {
        $callee = $this->person();
        $payload = ['to' => $callee->uuid, 'media' => 'audio', 'sdp' => ['type' => 'offer', 'sdp' => 'v=0']];

        $this->assertSubscriptionRequired($this->actingAs($this->person(), 'sanctum')->postJson('/api/v1/calls', $payload));
        $this->assertSubscriptionRequired($this->actingAs($this->person(), 'sanctum')->postJson('/api/v1/calls/group/invite', []));

        $this->setActionTier('call.start', 'auth');
        $this->assertNotSame(
            'subscription_required',
            $this->actingAs($this->person(), 'sanctum')->postJson('/api/v1/calls', $payload)->json('code'),
        );
    }

    public function test_staff_pass_subscription_gated_actions(): void
    {
        $moderator = User::factory()->create(['status' => UserStatus::Active, 'role' => UserRole::Moderator]);
        $channel = $this->channel($moderator);

        $this->assertNotSubscriptionGated(
            $this->actingAs($moderator, 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Запись']),
        );
    }

    private function scheduledPost(User $author): Post
    {
        $category = PostCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'is_active' => true,
        ]);

        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'category_id' => $category->id,
            'title' => 'Отложенная запись',
            'body' => 'Текст',
            'status' => ContentStatus::Scheduled,
            'scheduled_at' => now()->subMinute(),
        ]);
    }

    public function test_scheduler_returns_post_to_drafts_when_subscription_ran_out(): void
    {
        $author = $this->person();
        $post = $this->scheduledPost($author);

        $this->artisan('posts:publish-scheduled')->assertSuccessful();

        $post->refresh();
        $this->assertSame(ContentStatus::Draft, $post->status);
        $this->assertNull($post->scheduled_at);
        $this->assertNull($post->published_at);

        $notice = $author->notifications()->first();
        $this->assertNotNull($notice);
        $this->assertSame('Отложенная запись не опубликована', $notice->data['title'] ?? null);

        // Повторный прогон запись не трогает: она больше не в плане.
        $this->artisan('posts:publish-scheduled')->assertSuccessful();
        $this->assertSame(1, $author->notifications()->count());
    }

    public function test_scheduler_does_not_override_an_author_who_already_published(): void
    {
        $author = $this->person();
        $post = $this->scheduledPost($author);
        // Автор опубликовал сам между выборкой и проверкой подписки.
        Post::query()->whereKey($post->id)->update(['status' => ContentStatus::Published, 'published_at' => now()]);
        $stale = $post; // модель в памяти ещё «запланирована»

        $method = new \ReflectionMethod(PostService::class, 'returnToDraftsForSubscription');
        $method->invoke(app(PostService::class), $stale, $author);

        $this->assertSame(ContentStatus::Published, $post->fresh()->status);
        $this->assertSame(0, $author->notifications()->count());
    }

    public function test_scheduler_publishes_for_a_subscriber(): void
    {
        config(['feed.auto_publish' => true]);
        $post = $this->scheduledPost($this->subscriber());

        $this->artisan('posts:publish-scheduled')->assertSuccessful();

        $this->assertNotSame(ContentStatus::Draft, $post->fresh()->status);
        $this->assertNotSame(ContentStatus::Scheduled, $post->fresh()->status);
    }

    public function test_scheduler_follows_the_map_when_compose_is_open_to_everyone(): void
    {
        config(['feed.auto_publish' => true]);
        $this->setComposeTier('auth');
        $post = $this->scheduledPost($this->person());

        $this->artisan('posts:publish-scheduled')->assertSuccessful();

        $this->assertNotSame(ContentStatus::Draft, $post->fresh()->status);
        $this->assertNotSame(ContentStatus::Scheduled, $post->fresh()->status);
    }
}
