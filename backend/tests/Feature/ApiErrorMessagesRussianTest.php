<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Отказы приходят по-русски во всех разделах.
 *
 * Замер прода 17.09: «Unauthenticated.» на каждом закрытом маршруте,
 * «This action is unauthorized.» на отказе политики, «The route … could
 * not be found.», «The DELETE method is not supported…» и хвост валидации
 * «(and 1 more error)».
 */
class ApiErrorMessagesRussianTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        app()->setLocale('ru');
    }

    private function assertRussian(TestResponse $response, int $status): void
    {
        $response->assertStatus($status);
        $message = (string) $response->json('message');
        $this->assertNotSame('', $message, "пустое сообщение при {$status}");
        $this->assertMatchesRegularExpression('/[А-Яа-яЁё]/u', $message, "не по-русски при {$status}: {$message}");
        $this->assertDoesNotMatchRegularExpression('/\b(the|is|not|and|more|error|action|unauthorized|unauthenticated|found|method)\b/i', $message, "английский при {$status}: {$message}");
    }

    public function test_unauthenticated_is_russian(): void
    {
        $this->assertRussian($this->getJson('/api/v1/auth/me'), 401);
        $this->assertRussian($this->getJson('/api/v1/ordinary-deals'), 401);
        $this->assertRussian($this->withHeader('Authorization', 'Bearer 1|broken')->getJson('/api/v1/auth/me'), 401);
    }

    public function test_policy_denial_is_russian(): void
    {
        config(['feed.auto_publish' => true]);
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $channel = Channel::create(['owner_id' => $owner->id, 'name' => 'К', 'slug' => 'k-'.uniqid(), 'kind' => 'author', 'comments_enabled' => true]);
        $this->actingAs($owner, 'sanctum')->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Запись'])->assertCreated();
        $channel->forceFill(['comments_enabled' => false])->save();
        $uuid = ChannelPost::query()->firstOrFail()->feedPost->uuid;

        $reader = User::factory()->create(['status' => UserStatus::Active]);
        $this->assertRussian($this->actingAs($reader, 'sanctum')->postJson("/api/v1/posts/{$uuid}/comments", ['body' => 'текст']), 403);
    }

    public function test_role_middleware_denial_is_russian(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $this->assertRussian($this->actingAs($user, 'sanctum')->getJson('/api/v1/admin/settings'), 403);
    }

    public function test_bare_abort_is_russian(): void
    {
        $stranger = User::factory()->create(['status' => UserStatus::Active]);
        $this->assertRussian($this->actingAs($stranger, 'sanctum')->getJson('/api/v1/media/00000000-0000-0000-0000-000000000000'), 404);
    }

    public function test_router_errors_are_russian(): void
    {
        $this->assertRussian($this->getJson('/api/v1/no-such-route'), 404);
        $this->assertRussian($this->deleteJson('/api/v1/categories/posts'), 405);
    }

    public function test_validation_summary_tail_is_russian(): void
    {
        $response = $this->postJson('/api/v1/auth/login', ['email' => 'not-an-email']);
        $this->assertRussian($response, 422);
        $this->assertStringContainsString('ещё 1', (string) $response->json('message'));
    }
}
