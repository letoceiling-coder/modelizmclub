<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Services\SubscriptionAccess;
use Modules\Billing\Services\SubscriptionAccessResolver;
use Tests\TestCase;

/**
 * Сводка о подписке говорит то же, что решает гейт.
 *
 * РАЗБОР 03.10. Пользователь 1201: строка подписки `active` до 24.02.2027,
 * админка показывает «активна до 24.02.2027», а продукт отказывает. Оплата у
 * него была через тестовый эквайринг (`provider = stub`,
 * `metadata.test_acquiring = true`), а такие `hasPaidSubscriptionPayment()` не
 * признаёт, пока настоящий шлюз живой. Сводка об этом не спрашивала: считала
 * `is_active` из `status` и `ends_at`. Так в админке и родилось обещание
 * доступа, которого нет, — и по нему отвечали человеку.
 *
 * Проверка держит два пути вместе. Если правила доступа поменяются в
 * `hasActiveSubscription()`, а резолвер не поменяется — упадёт здесь, а не в
 * поддержке.
 */
class SubscriptionAccessMatchesGateTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Живой шлюз — ВТБ, как на проде.
     *
     * БЕЗ ЭТОГО ДЕФЕКТ НЕ ВОСПРОИЗВОДИТСЯ, и это само по себе объяснение,
     * почему случай 1201 не поймал ни один из 1493 тестов. В `.env.testing`
     * ВТБ не настроен, `PaymentGatewayManager::provider()` отвечает `stub`, и
     * тогда исключение stub-оплат в `hasPaidSubscriptionPayment()` не
     * применяется вовсе — тестовая оплата даёт доступ, и всё сходится.
     * Расходиться начинает только там, где настоящий шлюз живой.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.token' => 'тестовый-токен-для-проверки',
        ]);
    }

    /**
     * Случай 1201, воспроизведённый: оплата тестовым эквайрингом, живая
     * строка, основания нет.
     */
    public function test_оплата_тестовым_эквайрингом_не_даёт_доступа_и_сводка_это_говорит(): void
    {
        $человек = $this->человек();
        $this->строкаПодписки($человек, ['granted_by_admin_id' => null]);
        $this->оплата($человек, 'stub');

        $this->assertFalse(
            $человек->hasActiveSubscription(),
            'Предусловие: тестовая оплата доступа не даёт.'
        );

        $сводка = app(SubscriptionAccessResolver::class)->forUser($человек)->toArray();

        $this->assertFalse($сводка['is_active'], 'Сводка обещает доступ, которого гейт не даёт.');
        $this->assertSame(SubscriptionAccess::БЕЗ_ОСНОВАНИЯ, $сводка['access_basis']);
        $this->assertSame('no_basis', $сводка['status'], 'Такую строку нельзя называть active.');
        $this->assertNotNull($сводка['ends_at'], 'Срок из строки показать всё равно надо.');
    }

    public function test_оплата_настоящим_шлюзом_даёт_доступ(): void
    {
        $человек = $this->человек();
        $this->строкаПодписки($человек, ['granted_by_admin_id' => null]);
        $this->оплата($человек, 'vtb');

        $сводка = app(SubscriptionAccessResolver::class)->forUser($человек)->toArray();

        $this->assertTrue($человек->hasActiveSubscription());
        $this->assertTrue($сводка['is_active']);
        $this->assertSame(SubscriptionAccess::ОПЛАЧЕНО, $сводка['access_basis']);
        $this->assertSame('active', $сводка['status']);
    }

    public function test_выдача_руками_даёт_доступ_и_названа_выдачей(): void
    {
        $человек = $this->человек();
        $this->строкаПодписки($человек, ['granted_by_admin_id' => $человек->id]);

        $сводка = app(SubscriptionAccessResolver::class)->forUser($человек)->toArray();

        $this->assertTrue($человек->hasActiveSubscription());
        $this->assertTrue($сводка['is_active']);
        $this->assertSame(SubscriptionAccess::ВЫДАНА, $сводка['access_basis']);
    }

    public function test_освобождённый_без_строки_тоже_с_доступом(): void
    {
        $человек = $this->человек(['subscription_exempt' => true]);

        $сводка = app(SubscriptionAccessResolver::class)->forUser($человек)->toArray();

        $this->assertTrue($человек->hasActiveSubscription() || $человек->hasSubscriptionAccess());
        $this->assertTrue($сводка['is_active']);
        $this->assertSame(SubscriptionAccess::ОСВОБОЖДЁН, $сводка['access_basis']);
    }

    public function test_без_подписки_сводки_нет(): void
    {
        $человек = $this->человек();

        $this->assertNull(app(SubscriptionAccessResolver::class)->forUser($человек)->toArray());
    }

    public function test_просроченная_строка_называется_истёкшей(): void
    {
        $человек = $this->человек();
        $this->строкаПодписки($человек, [
            'granted_by_admin_id' => $человек->id,
            'ends_at' => now()->subDay(),
        ]);

        $сводка = app(SubscriptionAccessResolver::class)->forUser($человек)->toArray();

        $this->assertFalse($сводка['is_active']);
        $this->assertSame('expired', $сводка['status']);
    }

    /**
     * Сводка и гейт сходятся на всех шести расстановках сразу.
     *
     * Поштучные проверки выше читаются, но не ловят расхождение в порядке
     * оснований. Эта — ловит: она сравнивает два пути на каждом человеке.
     */
    public function test_сводка_и_гейт_сходятся_на_всех_расстановках(): void
    {
        $расстановки = [
            'тестовая оплата' => fn (User $u) => [$this->строкаПодписки($u, ['granted_by_admin_id' => null]), $this->оплата($u, 'stub')],
            'настоящая оплата' => fn (User $u) => [$this->строкаПодписки($u, ['granted_by_admin_id' => null]), $this->оплата($u, 'vtb')],
            'выдана руками' => fn (User $u) => [$this->строкаПодписки($u, ['granted_by_admin_id' => $u->id])],
            'отменена, срок не истёк' => fn (User $u) => [$this->строкаПодписки($u, ['status' => 'cancelled'])],
            'просрочена' => fn (User $u) => [$this->строкаПодписки($u, ['ends_at' => now()->subDay()])],
            'нет строки' => fn (User $u) => [],
        ];

        foreach ($расстановки as $имя => $подготовить) {
            $человек = $this->человек();
            $подготовить($человек);
            $человек->refresh();

            $гейт = $человек->hasActiveSubscription();
            $сводка = app(SubscriptionAccessResolver::class)->forUser($человек);

            $this->assertSame(
                $гейт,
                $сводка->доступ,
                "«{$имя}»: гейт говорит ".var_export($гейт, true)
                    .', а сводка — '.var_export($сводка->доступ, true)
                    ." (основание: {$сводка->основание})"
            );
        }
    }

    /**
     * Список админки не превращается в N+1.
     *
     * Правило доступа стоит до трёх запросов на человека. Если резолвер
     * спросить по одному на страницу из двадцати, выйдет шестьдесят лишних —
     * обмен одной находки аудита на другую. Поэтому порог, а не «на глаз».
     */
    public function test_страница_людей_стоит_постоянное_число_запросов(): void
    {
        $люди = collect(range(1, 12))->map(function (int $i): User {
            $человек = $this->человек();
            $this->строкаПодписки($человек, ['granted_by_admin_id' => $i % 2 === 0 ? $человек->id : null]);
            if ($i % 3 === 0) {
                $this->оплата($человек, 'vtb');
            }

            return $человек;
        });

        $resolver = app(SubscriptionAccessResolver::class);

        DB::enableQueryLog();
        DB::flushQueryLog();
        $резолв = $resolver->forUsers($люди);
        $пакетом = count(DB::getQueryLog());

        // Повторные вопросы по одному идут из памяти — ни одного запроса.
        DB::flushQueryLog();
        foreach ($люди as $человек) {
            $resolver->forUser($человек);
        }
        $поштучно = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertCount(12, $резолв);
        $this->assertLessThanOrEqual(
            4,
            $пакетом,
            "Пакетный резолв двенадцати человек стоил {$пакетом} запросов — ожидалось не больше четырёх."
        );
        $this->assertSame(
            0,
            $поштучно,
            "Повторные вопросы по одному стоили {$поштучно} запросов — память резолвера не работает."
        );
    }

    /**
     * Админка перестала обещать доступ, которого нет.
     *
     * Эта проверка — та, что падает на прежнем коде: карточка и список
     * считали `is_active` из строки и отвечали `true`. Резолвер сам по себе
     * мог быть верным, а интерфейс продолжал бы врать, — поэтому спрашиваем
     * по-настоящему, через HTTP.
     */
    public function test_карточка_и_список_в_админке_не_называют_такую_подписку_активной(): void
    {
        $владелец = $this->человек(['role' => UserRole::Owner]);
        $игорь = $this->человек();
        $this->строкаПодписки($игорь, ['granted_by_admin_id' => null]);
        $this->оплата($игорь, 'stub');

        $карточка = $this->actingAs($владелец, 'sanctum')
            ->getJson("/api/v1/admin/users/{$игорь->uuid}/card")
            ->assertOk()
            ->json('data.subscription');

        $this->assertFalse($карточка['is_active'], 'Карточка обещает доступ, которого нет.');
        $this->assertSame(SubscriptionAccess::БЕЗ_ОСНОВАНИЯ, $карточка['access_basis']);
        $this->assertSame('строка есть, основания нет', $карточка['access_basis_label']);

        $строки = $this->actingAs($владелец, 'sanctum')
            ->getJson('/api/v1/admin/users?per_page=50')
            ->assertOk()
            ->json('data');

        $его = collect($строки)->firstWhere('uuid', $игорь->uuid);

        $this->assertNotNull($его, 'Человека нет в списке админки.');
        $this->assertFalse($его['subscription']['is_active'], 'Список обещает доступ, которого нет.');
        $this->assertSame(SubscriptionAccess::БЕЗ_ОСНОВАНИЯ, $его['subscription']['access_basis']);
    }

    /** @param array<string, mixed> $поля */
    private function человек(array $поля = []): User
    {
        return User::factory()->create(array_merge([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ], $поля));
    }

    /** @param array<string, mixed> $поля */
    private function строкаПодписки(User $человек, array $поля = []): UserSubscription
    {
        return UserSubscription::query()->create(array_merge([
            'user_id' => $человек->id,
            'plan_id' => $this->план()->id,
            'status' => 'active',
            'starts_at' => now()->subMonth(),
            'ends_at' => now()->addYear(),
            'auto_renew' => false,
            'granted_by_admin_id' => null,
        ], $поля));
    }

    private function оплата(User $человек, string $провайдер): Payment
    {
        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $человек->id,
            'status' => 'paid',
            'provider' => $провайдер,
            'amount_cents' => 44900,
            'currency' => 'RUB',
            'metadata' => ['plan_id' => $this->план()->id, 'test_acquiring' => $провайдер === 'stub'],
        ]);
    }

    private function план(): SubscriptionPlan
    {
        return SubscriptionPlan::query()->firstOrCreate(
            ['slug' => 'half-test'],
            [
                'name' => 'Полгода',
                'price_cents' => 44900,
                'period_days' => 180,
                'is_active' => true,
                'sort_order' => 20,
            ],
        );
    }
}
