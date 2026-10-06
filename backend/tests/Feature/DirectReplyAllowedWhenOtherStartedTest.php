<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Отвечать можно в переписке, которую начал не ты. Решение владельца Е6
 * от 06.10.
 *
 * До правки человеку могли написать — подписчик вправе написать кому
 * угодно, — а ответить он не мог: ни подписки, ни дружбы. Переписка выходила
 * односторонней, и снаружи это выглядело поломкой, а не правилом. Случай был
 * назван в сессии 4 и оставлен владельцу вопросом; поведение тогда не
 * меняли — ответ пришёл 06.10.
 *
 * «Начал» считается по первому сообщению, а не по строке участника:
 * `findOrCreateDirect` ставит обоим `role => member` и один и тот же
 * `joined_at`, то есть по участникам инициатора не отличить.
 *
 * Правило узкое, и проверки здесь ровно о его границах:
 *
 * 1. получатель отвечает — то, что решение разрешает;
 * 2. начать новую переписку с третьим лицом он по-прежнему не может;
 * 3. заблокированный не отвечает;
 * 4. пустая переписка (создана, но без сообщений) права не даёт;
 * 5. тот, кто начал сам, после потери подписки писать не может — правило
 *    не расползлось на обратный случай.
 *
 * Доказательство откатом, проверено 06.10 — оба отката прогнаны вместе с
 * `DirectMessagesOpenToFriendsTest`, чтобы видеть и прежние правила:
 *
 * | Откат | Что краснеет |
 * | --- | --- |
 * | ветку `startedBySomeoneElse` убрать | `получатель_отвечает`, `заблокированный_не_отвечает` |
 * | отправку разрешить всем участникам | `пустая_переписка_права_не_даёт`, `начавший_после_потери_подписки`, `после_удаления_из_друзей_переписка_закрыта` |
 *
 * `заблокированный_не_отвечает` краснеет на первом откате не случайно и не
 * впустую: без ветки Е6 политика отказывает раньше (403), и проверка блока
 * до дела не доходит. То есть этот случай закрепляет ПОРЯДОК — при
 * действующем правиле Е6 блокировка всё равно сильнее и даёт 422, а не 201.
 */
class DirectReplyAllowedWhenOtherStartedTest extends TestCase
{
    use RefreshDatabase;

    public function test_получатель_отвечает_без_подписки_и_дружбы(): void
    {
        [$подписчик, $получатель, $uuid] = $this->перепискуНачалПодписчик();

        $this->actingAs($получатель, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'И вам привет'])
            ->assertCreated();

        /* Дружбы и подписки у получателя так и не появилось. */
        $this->assertSame(0, DB::table('user_friendships')
            ->whereIn('user_id', [$подписчик->id, $получатель->id])
            ->count());
        $this->assertFalse($получатель->fresh()->hasSubscriptionAccess());
    }

    public function test_получатель_не_может_начать_переписку_с_третьим(): void
    {
        [, $получатель] = $this->перепискуНачалПодписчик();
        $третий = $this->человек('Виктор');

        $this->actingAs($получатель, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $третий->id])
            ->assertForbidden()
            ->assertJsonPath('code', 'friendship_required');
    }

    public function test_заблокированный_не_отвечает(): void
    {
        [$подписчик, $получатель, $uuid] = $this->перепискуНачалПодписчик();

        DB::table('user_blocks')->insert([
            'blocker_id' => $подписчик->id,
            'blocked_id' => $получатель->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($получатель, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Всё равно напишу'])
            ->assertStatus(422);
    }

    /**
     * Переписка создана, но ни одного слова в ней нет: отвечать не на что,
     * и права это не даёт. Иначе «создать и бросить» стало бы способом
     * выдать человеку доступ к переписке в обход правила.
     */
    public function test_пустая_переписка_права_не_даёт(): void
    {
        $подписчик = $this->человек('Аня');
        $this->выдатьПодписку($подписчик);
        $получатель = $this->человек('Борис');

        $uuid = $this->actingAs($подписчик, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $получатель->id])
            ->assertCreated()
            ->json('data.uuid');

        $this->app['auth']->forgetGuards();
        $this->actingAs($получатель, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Первым буду я'])
            ->assertForbidden()
            ->assertJsonPath('code', 'friendship_required');
    }

    /**
     * Обратный случай правилом не покрыт и не должен открыться сам: начал
     * сам, подписка кончилась — писать нельзя, как и до 06.10.
     */
    public function test_начавший_после_потери_подписки_писать_не_может(): void
    {
        [$подписчик, , $uuid] = $this->перепискуНачалПодписчик();

        DB::table('user_subscriptions')->where('user_id', $подписчик->id)->update([
            'status' => 'cancelled',
            'ends_at' => now()->subDay(),
        ]);

        $this->app['auth']->forgetGuards();
        $this->actingAs($подписчик->fresh(), 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Ещё раз'])
            ->assertForbidden()
            ->assertJsonPath('code', 'friendship_required');
    }

    /**
     * Подписчик пишет не-другу и не-подписчику — то, что правило разрешало и
     * раньше. Возвращает обоих и uuid переписки с одним сообщением в ней.
     *
     * @return array{0: User, 1: User, 2: string}
     */
    private function перепискуНачалПодписчик(): array
    {
        $подписчик = $this->человек('Аня');
        $this->выдатьПодписку($подписчик);
        $получатель = $this->человек('Борис');

        $uuid = $this->actingAs($подписчик, 'sanctum')
            ->postJson('/api/v1/conversations', ['user_id' => $получатель->id])
            ->assertCreated()
            ->json('data.uuid');

        $this->actingAs($подписчик, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Здравствуйте'])
            ->assertCreated();

        $this->app['auth']->forgetGuards();

        return [$подписчик->fresh(), $получатель->fresh(), (string) $uuid];
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
