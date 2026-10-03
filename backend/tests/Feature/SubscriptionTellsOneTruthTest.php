<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * О подписке все отвечают одно и то же.
 *
 * 03.10 на проде у 1201 строка подписки жила до 24.02.2027, карточка
 * админки показывала «активна до 24.02.2027» и кнопку «Продлить
 * подписку», а человек на каждом закрытом действии получал окно оплаты.
 * Оплата была сделана тестовым эквайрингом (`provider=stub`), прод с тех
 * пор переключён на боевой, и `hasPaidSubscriptionPayment()` такие
 * платежи не считает. Ворота отказывали, админка обещала.
 *
 * Отдельно: значок «Pro» в шапке профиля был написан под поле
 * `user.subscription`, которого не заполнял ни один маппер, и не
 * показывался ни одному подписчику. Признак теперь приходит с сервера
 * (`is_subscriber`) и считается тем же вердиктом, что ворота.
 */
class SubscriptionTellsOneTruthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'half'],
            ['name' => 'Полгода', 'price_cents' => 44900, 'currency' => 'RUB', 'duration_days' => 182, 'sort_order' => 2],
        );
    }

    private function человек(string $slug): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'email_verified_at' => now()]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Подопытный '.$slug,
            'slug' => $slug.'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    /** Живая строка подписки, выданная не админом и без промо. */
    private function строкаПодписки(User $user, ?int $выдалАдмин = null): UserSubscription
    {
        return UserSubscription::create([
            'user_id' => $user->id,
            'plan_id' => SubscriptionPlan::where('slug', 'half')->value('id'),
            'status' => 'active',
            'starts_at' => now()->subDays(10),
            'ends_at' => now()->addDays(170),
            'auto_renew' => true,
            'granted_by_admin_id' => $выдалАдмин,
        ]);
    }

    private function оплатаЧерез(User $user, string $провайдер): Payment
    {
        return Payment::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => $user->id,
            'provider' => $провайдер,
            'status' => 'paid',
            'amount_cents' => 44900,
            'currency' => 'RUB',
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'half'],
        ]);
    }

    /** Боевой эквайринг: тестовые платежи перестают считаться оплатой. */
    private function боевойЭквайринг(): void
    {
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.token' => 'боевой-токен-для-проверки',
        ]);

        $this->assertSame(
            'vtb',
            app(\Modules\Billing\Services\PaymentGatewayManager::class)->provider(),
            'проверка бессмысленна, если провайдер остался тестовым',
        );
    }

    private function карточкаАдминки(User $кого): array
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);

        $ответ = $this->actingAs($админ, 'sanctum')
            ->getJson('/api/v1/admin/users?per_page=100')
            ->assertOk()
            ->json('data');

        foreach ($ответ as $строка) {
            if (($строка['uuid'] ?? null) === $кого->uuid) {
                return $строка;
            }
        }

        $this->fail('человека нет в списке админки — проверять нечего');
    }

    public function test_оплата_тестовым_эквайрингом_под_боевым_не_числится_активной(): void
    {
        $user = $this->человек('stub-paid');
        $this->оплатаЧерез($user, 'stub');
        $this->строкаПодписки($user);

        $this->боевойЭквайринг();

        // Ворота: доступа нет. Это поведение уже было, оно здесь как опора.
        $this->assertFalse($user->fresh()->hasActiveSubscription());

        $карточка = $this->карточкаАдминки($user);

        // Суть дефекта: админка обещала доступ, которого нет.
        $this->assertFalse(
            $карточка['subscription']['is_active'],
            'админка показывает активную подписку человеку, которому ворота отказывают',
        );
        $this->assertSame('not_entitled', $карточка['subscription']['status']);
        // Строку админ всё равно должен видеть: срок остаётся в ответе.
        $this->assertNotNull($карточка['subscription']['ends_at']);
    }

    public function test_та_же_строка_под_тестовым_эквайрингом_активна(): void
    {
        $user = $this->человек('stub-live');
        $this->оплатаЧерез($user, 'stub');
        $this->строкаПодписки($user);

        config(['billing.provider' => 'stub']);
        $this->assertSame('stub', app(\Modules\Billing\Services\PaymentGatewayManager::class)->provider());

        $this->assertTrue($user->fresh()->hasActiveSubscription());
        $карточка = $this->карточкаАдминки($user);
        $this->assertTrue($карточка['subscription']['is_active']);
        $this->assertSame('active', $карточка['subscription']['status']);
    }

    public function test_выданная_админом_подписка_активна_и_под_боевым(): void
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $user = $this->человек('granted');
        $this->строкаПодписки($user, $админ->id);

        $this->боевойЭквайринг();

        $this->assertTrue($user->fresh()->hasActiveSubscription());
        $this->assertTrue($this->карточкаАдминки($user)['subscription']['is_active']);
    }

    public function test_auth_me_называет_подписчика(): void
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $подписчик = $this->человек('me-sub');
        $this->строкаПодписки($подписчик, $админ->id);

        $this->actingAs($подписчик->fresh(), 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.is_subscriber', true);

        $без = $this->человек('me-free');
        $this->actingAs($без, 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.is_subscriber', false);
    }

    public function test_льгота_не_делает_сотрудника_подписчиком(): void
    {
        $сотрудник = $this->человек('exempt');
        // Не `update`: `subscription_exempt` не в `$fillable` — льготу
        // ставит только админка, и массовое присваивание её не берёт.
        $сотрудник->forceFill(['subscription_exempt' => true])->save();

        // Закрытое подпиской ему открыто…
        $this->assertTrue($сотрудник->fresh()->hasSubscriptionAccess());

        // …но подписчиком он не называется, и отметки «Pro» не получает.
        $this->actingAs($сотрудник->fresh(), 'sanctum')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.is_subscriber', false);
    }

    public function test_чужой_профиль_отдаёт_признак_без_срока(): void
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $подписчик = $this->человек('public-sub');
        $this->строкаПодписки($подписчик, $админ->id);
        $slug = $подписчик->profile->slug;

        $ответ = $this->getJson("/api/v1/users/{$slug}")->assertOk();
        $ответ->assertJsonPath('data.is_subscriber', true);
        // Срок и автопродление наружу не уходят.
        $ответ->assertJsonMissingPath('data.subscription');
        $ответ->assertJsonMissingPath('data.ends_at');

        $без = $this->человек('public-free');
        $this->getJson('/api/v1/users/'.$без->profile->slug)
            ->assertOk()
            ->assertJsonPath('data.is_subscriber', false);
    }
}
