<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\User\Services\FriendService;
use Tests\TestCase;

/**
 * Личную переписку открывает дружба либо подписка.
 *
 * Решение владельца от 05.10. До него сервер требовал подписку всегда, а
 * интерфейс спрашивал дружбу: на профиле «Написать» проверяет `is_friend` и
 * предлагает окно «Добавьте пользователя в друзья». Друг без подписки
 * проходил проверку клиента и получал 403 `subscription_required`, после
 * чего ему показывали окно подписки — то есть просили заплатить за то, что
 * по правилу открыто.
 *
 * Здесь закреплены все пять случаев из решения. Одной проверкой такое
 * правило не закрепить: «друзья без подписки — можно» зеленеет и при старом
 * правиле, если у человека случайно есть подписка, а «не друзья — отказ»
 * зеленеет при правиле «всем нельзя».
 *
 * Доказательство откатом (проверено 05.10): если вернуть
 * `create()` и `send()` к `return $this->isSubscriber($user)`, краснеют
 * `test_друзья_без_подписки_начинают_переписку` и
 * `test_друзья_без_подписки_отправляют_сообщение`; если наоборот отдать
 * переписку всем, краснеют `test_не_друзья_без_подписки_получают_отказ`,
 * `test_после_удаления_из_друзей_переписка_закрыта` и
 * `test_заблокированному_переписка_закрыта`.
 */
class DirectMessagesOpenToFriendsTest extends TestCase
{
    use RefreshDatabase;

    public function test_друзья_без_подписки_начинают_переписку(): void
    {
        [$a, $b] = $this->двоеДрузей();

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $b->id])
            ->assertCreated();
    }

    public function test_друзья_без_подписки_отправляют_сообщение(): void
    {
        [$a, $b] = $this->двоеДрузей();
        $uuid = $this->диалог($a, $b);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Привет'])
            ->assertCreated();
    }

    public function test_не_друзья_без_подписки_получают_отказ(): void
    {
        $a = $this->человек('Аня');
        $c = $this->человек('Виктор');

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $c->id])
            ->assertForbidden()
            ->assertJsonPath('code', 'friendship_required');
    }

    public function test_подписчик_пишет_не_другу_как_раньше(): void
    {
        $a = $this->человек('Аня');
        $c = $this->человек('Виктор');
        $this->выдатьПодписку($a);

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $c->id])
            ->assertCreated();
    }

    public function test_после_удаления_из_друзей_переписка_закрыта(): void
    {
        [$a, $b] = $this->двоеДрузей();
        $uuid = $this->диалог($a, $b);

        app(FriendService::class)->removeFriend($a, $b);

        $this->app['auth']->forgetGuards();
        $this->actingAs($a->fresh(), 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Ещё раз'])
            ->assertForbidden();
    }

    public function test_заблокированному_переписка_закрыта(): void
    {
        [$a, $b] = $this->двоеДрузей();
        DB::table('user_blocks')->insert([
            'blocker_id' => $b->id,
            'blocked_id' => $a->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($a, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $b->id])
            ->assertStatus(422);
    }

    /**
     * Чаты направлений дружбой не открываются.
     *
     * Решение владельца оставляет их за подпиской: собеседник там не один, и
     * «взаимная дружба» к такому чату не применима. Проверка стоит, чтобы
     * правило для личной переписки не расползлось на остальные типы.
     */
    public function test_подписка_остаётся_условием_для_чатов_направлений(): void
    {
        $a = $this->человек('Аня');
        $room = \App\Models\Conversation::create([
            'type' => \App\Enums\ConversationType::Room,
            'last_message_at' => now(),
        ]);
        \App\Models\ConversationParticipant::create([
            'conversation_id' => $room->id,
            'user_id' => $a->id,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $this->actingAs($a, 'sanctum')
            ->postJson("/api/v1/conversations/{$room->uuid}/messages", ['body' => 'Всем привет'])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    /** @return array{0: User, 1: User} */
    private function двоеДрузей(): array
    {
        $a = $this->человек('Аня');
        $b = $this->человек('Борис');
        $friends = app(FriendService::class);
        $request = $friends->sendRequest($a, $b);
        $friends->acceptRequest($b, $request);

        return [$a->fresh(), $b->fresh()];
    }

    private function диалог(User $from, User $to): string
    {
        return $this->actingAs($from, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $to->id])
            ->assertCreated()
            ->json('data.uuid') ?? '';
    }

    private function выдатьПодписку(User $user): void
    {
        $admin = $this->человек('Админ', UserRole::Owner);
        // Тестовая база поднимается миграциями без семян, поэтому тариф
        // создаём сами: проверке важен факт подписки, а не её цена.
        $planId = DB::table('subscription_plans')->insertGetId([
            'slug' => 'test-year-'.uniqid(),
            'name' => 'Год (проба)',
            'price_cents' => 79900,
            'period_days' => 365,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_subscriptions')->insert([
            'user_id' => $user->id,
            'plan_id' => $planId,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
            'auto_renew' => false,
            'granted_by_admin_id' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function человек(string $имя, UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'role' => $role,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }
}
