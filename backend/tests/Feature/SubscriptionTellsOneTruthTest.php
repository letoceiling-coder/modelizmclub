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
            // Колонки — как в миграции: `period_days`, и никакого `currency`.
            // Лишние имена Eloquent отбрасывает молча, и план «Полгода»
            // получал бы period_days = 30 при написанных 182.
            ['name' => 'Полгода', 'price_cents' => 44900, 'period_days' => 182, 'sort_order' => 2],
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

    /** Окно «Карточка пользователя» — отдельная ручка со своим ответом. */
    private function карточкаЧеловека(User $кого): array
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);

        return $this->actingAs($админ, 'sanctum')
            ->getJson("/api/v1/admin/users/{$кого->uuid}/card")
            ->assertOk()
            ->json('data.subscription');
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

        /*
         * И окно карточки — отдельная ручка. Здесь лежала вторая копия
         * расчёта, и правка одной из двух развела ответы: список говорил
         * «оплата не подтверждена», карточка на том же человеке — «активна
         * до 24.02.2027». Это тот самый экран, с которого начался разбор.
         */
        $окно = $this->карточкаЧеловека($user);
        $this->assertFalse($окно['is_active'], 'окно карточки обещает доступ, которого нет');
        $this->assertSame('not_entitled', $окно['status']);
        $this->assertSame(
            $карточка['subscription'],
            $окно,
            'список и карточка обязаны говорить о подписке одно и то же',
        );
    }

    /**
     * Выдача подписки не отнимает живой срок.
     *
     * `activate` считал базу от `now()`, а кнопку выбирает экран по тому,
     * открыт ли доступ. У 1201 доступ закрыт при живой строке до
     * 24.02.2027 — кнопка назвалась «Выдать подписку», и один клик
     * Владельца укоротил бы подписку до 02.11.2026. Вернуть срок можно было
     * бы только из `audit_logs.old_values`.
     */
    public function test_выдача_не_укорачивает_живой_срок(): void
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $user = $this->человек('no-shorten');
        $строка = $this->строкаПодписки($user);
        $былоДо = $строка->ends_at->copy();

        $this->actingAs($админ, 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'activate', 'days' => 30])
            ->assertOk();

        $стало = $строка->fresh()->ends_at;
        $this->assertTrue(
            $стало->greaterThanOrEqualTo($былоДо),
            'выдача укоротила срок: было '.$былоДо->toDateString().', стало '.$стало->toDateString(),
        );
        $this->assertSame($былоДо->copy()->addDays(30)->toDateString(), $стало->toDateString());
    }

    /**
     * Вердикт считается один раз.
     *
     * Внутри до трёх запросов, один из которых выбирает список id из
     * `users`. Спрашивают его теперь трое: `is_subscriber` в своём ресурсе,
     * сводка для админки и публичный профиль, — и без памяти список админки
     * платил бы за каждую строку по разу поверх того, что и так считает.
     */
    public function test_вердикт_о_подписке_не_пересчитывается(): void
    {
        $админ = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $user = $this->человек('memo');
        $this->строкаПодписки($user, $админ->id);
        $свежий = $user->fresh();

        \Illuminate\Support\Facades\DB::flushQueryLog();
        \Illuminate\Support\Facades\DB::enableQueryLog();
        $свежий->hasActiveSubscription();
        $первый = count(\Illuminate\Support\Facades\DB::getQueryLog());

        \Illuminate\Support\Facades\DB::flushQueryLog();
        for ($i = 0; $i < 5; $i++) {
            $свежий->hasActiveSubscription();
        }
        $повторные = count(\Illuminate\Support\Facades\DB::getQueryLog());
        \Illuminate\Support\Facades\DB::disableQueryLog();

        $this->assertGreaterThan(0, $первый, 'первый вызов обязан что-то спросить — иначе мерить нечего');
        $this->assertSame(0, $повторные, 'повторные вызовы снова ходят в базу: памяти нет');
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
