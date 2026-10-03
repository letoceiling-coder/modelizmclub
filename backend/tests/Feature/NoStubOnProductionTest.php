<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;
use Modules\Billing\Services\PaymentGatewayManager;
use Tests\TestCase;

/**
 * На боевом окружении подменного шлюза не бывает.
 *
 * `PaymentGatewayManager::resolve()` в обеих ветках с ВТБ заканчивался
 * `: $this->stub` — ненастроенный шлюз подменялся подменным, то есть
 * страницей с выбором исхода «оплачено / нет денег / отказ карты». На проде
 * это значит, что человек проходит ненастоящую оплату.
 *
 * Дотянуться можно не опечаткой, а сбоем, который уже случался: 07.09
 * `config:clear` при нечитаемом `.env` обнулил все `env()`. Тогда
 * `BILLING_PROVIDER` становится `auto`, `VTB_ACQUIRING_ENABLED` — `false`,
 * резолв даёт подменный шлюз, а `ConfirmStubPaymentController` в режиме
 * `auto` такие платежи подтверждать разрешает. То есть потеря `.env` на проде
 * оборачивается бесплатными подписками, а не только простоем.
 */
class NoStubOnProductionTest extends TestCase
{
    use RefreshDatabase;

    private function боевоеОкружение(): void
    {
        $this->app['env'] = 'production';
    }

    private function ненастроенныйВтб(string $режим): void
    {
        config([
            'billing.provider' => $режим,
            'billing.vtb.enabled' => false,
            'billing.vtb.api_url' => null,
            'billing.vtb.username' => null,
            'billing.vtb.password' => null,
            'billing.vtb.token' => null,
        ]);
    }

    private function человек(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    /**
     * Проверяется поведение, а не ответ резолва.
     *
     * `provider()` обязан отвечать правду и на проде: на нём держится
     * диагностика — `deploy/scripts/check-live-money.sh` считает `stub`
     * находкой, и если резолв начнёт врать, проверка перестанет видеть
     * проблему. Поэтому запрет стоит на создании платежа и на подтверждении,
     * а не на самом вопросе «какой шлюз».
     */
    public function test_на_проде_платёж_не_создаётся_подменным_шлюзом(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        $this->expectException(PaymentContourUnavailableException::class);

        app(PaymentGatewayManager::class)->createCheckout(
            $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
        );
    }

    public function test_в_режиме_vtb_на_проде_тоже_отказ(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('vtb');

        $this->expectException(PaymentContourUnavailableException::class);

        app(PaymentGatewayManager::class)->createCheckout(
            $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
        );
    }

    public function test_отказ_приходит_ответом_503_а_не_пятисоткой(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'month'],
            ['name' => 'Месяц', 'price_cents' => 9900, 'period_days' => 30, 'sort_order' => 1],
        );

        // Обработчик исключений не отключаем: проверяется как раз то, что
        // исключение само превращается в ответ, а не в пятисотку.
        $ответ = $this->actingAs($this->человек(), 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'month']);

        $ответ->assertStatus(503);
        $ответ->assertJsonPath('code', 'payment_contour_unavailable');
        // Текст тоже закреплён: `bootstrap/app.php` переписывает `message`
        // каждого ответа ≥400 через `ApiErrorMessage::translate`, и появись в
        // `lang/ru.json` ключ с этой строкой — она сменилась бы молча.
        $ответ->assertJsonPath('message', 'Оплата временно недоступна: платёжный шлюз не настроен.');
    }

    public function test_вне_прода_подмена_остаётся(): void
    {
        // Разработка и стенд на подменном шлюзе и живут — запрет только боевой.
        $this->ненастроенныйВтб('auto');

        $this->assertTrue(app(PaymentGatewayManager::class)->stubAllowed());
        $результат = app(PaymentGatewayManager::class)->createCheckout(
            $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
        );
        $this->assertNotEmpty($результат);
    }

    /**
     * Явный `vtb` запрещает подмену и вне прода.
     *
     * Раз провайдер назван, молча подставлять другой нельзя: иначе
     * разработчик правит боевой контур, а проверяет подменный. Условие взято
     * из ветки аудита 03.10 — оно строже, чем «только на проде», и это верно.
     */
    public function test_явный_vtb_запрещает_подмену_и_на_стенде(): void
    {
        // Окружение не боевое — запрет держится всё равно.
        $this->ненастроенныйВтб('vtb');

        $this->assertFalse(app(PaymentGatewayManager::class)->stubAllowed());
        $this->expectException(PaymentContourUnavailableException::class);
        app(PaymentGatewayManager::class)->createCheckout(
            $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
        );
    }

    /** Причина отказа уходит в журнал по полям, а не одной строкой. */
    public function test_отказ_пишет_в_журнал_чего_не_хватило(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        \Illuminate\Support\Facades\Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $сообщение, array $поля): bool {
                return str_contains($сообщение, 'не настроен')
                    && ($поля['billing_provider'] ?? null) === 'auto'
                    && array_key_exists('VTB_ACQUIRING_API_URL', $поля['заполнено'] ?? []);
            });

        try {
            app(PaymentGatewayManager::class)->createCheckout(
                $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
            );
            $this->fail('отказа не было');
        } catch (PaymentContourUnavailableException) {
            // то, что и ожидается
        }
    }

    public function test_явный_stub_работает_и_на_проде(): void
    {
        // Решение явное и видно в `.env` — его запрещать незачем.
        $this->боевоеОкружение();
        config(['billing.provider' => 'stub']);

        $this->assertTrue(app(PaymentGatewayManager::class)->stubAllowed());
        $this->assertSame('stub', app(PaymentGatewayManager::class)->provider());
    }

    public function test_диагностика_продолжает_видеть_подменный_шлюз(): void
    {
        /*
         * Главное, чего нельзя было ломать. `check-live-money.sh` на каждой
         * выкатке спрашивает `provider()` и считает `stub` находкой. Если
         * запрет сделать внутри резолва, на проде вместо `stub` придёт `vtb`,
         * проверка скажет «боевой контур» и перестанет видеть то, ради чего
         * она есть.
         */
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        $this->assertSame('stub', app(PaymentGatewayManager::class)->provider());
        $this->assertFalse(app(PaymentGatewayManager::class)->stubAllowed());
    }

    public function test_подтверждение_подменной_оплаты_на_проде_отвергается(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'month'],
            ['name' => 'Месяц', 'price_cents' => 9900, 'period_days' => 30, 'sort_order' => 1],
        );
        $user = $this->человек();
        $платёж = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'provider' => 'stub',
            'status' => 'pending',
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'month'],
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/confirm-stub", ['outcome' => 'paid'])
            ->assertStatus(403);

        $this->assertSame('pending', $платёж->fresh()->status, 'подменная оплата подтвердилась на проде');
        $this->assertFalse($user->fresh()->hasActiveSubscription(), 'подписка выдана за ненастоящую оплату');
    }

    public function test_вне_прода_подтверждение_работает(): void
    {
        $this->ненастроенныйВтб('auto');
        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'month'],
            ['name' => 'Месяц', 'price_cents' => 9900, 'period_days' => 30, 'sort_order' => 1],
        );
        $user = $this->человек();
        $платёж = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'provider' => 'stub',
            'status' => 'pending',
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'month'],
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/confirm-stub", ['outcome' => 'paid'])
            ->assertOk();
    }

    /**
     * Запрет стоит в горловине, а не только в менеджере.
     *
     * `PaymentGatewayManager::resolve()` и `gatewayForProvider()` публичные:
     * первый уже зовут снаружи (`CardBindingService`), второй отдаёт подменный
     * шлюз для всего, что не `vtb`, и вызывающих у него пока ноль — то есть это
     * готовая калитка мимо запрета в `createCheckout` менеджера.
     */
    public function test_подменный_шлюз_отказывает_и_напрямую(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        $this->expectException(PaymentContourUnavailableException::class);

        app(\Modules\Billing\Services\StubPaymentGateway::class)->createCheckout(
            $this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription'],
        );
    }

    public function test_подменный_шлюз_отказывает_и_через_gatewayForProvider(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        $this->expectException(PaymentContourUnavailableException::class);

        app(PaymentGatewayManager::class)
            ->gatewayForProvider('stub')
            ->createCheckout($this->человек(), 9900, 'RUB', 'Подписка «Месяц»', ['payable_type' => 'subscription']);
    }

    /**
     * Подменный вебхук на проде не доводит платёж до оплаты.
     *
     * Подписи он не проверяет и банк не спрашивает — в отличие от
     * `VtbPaymentGateway`. Сегодня до него не дотянуться: маршрут вебхука
     * внедряет `VtbPaymentGateway` по классу. Но три из четырёх точек создания
     * платежа внедряют интерфейс, и одна правка внедрения отделяла это от живой
     * дыры.
     */
    public function test_подменный_вебхук_на_проде_ничего_не_оплачивает(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');
        $платёж = $this->подменныйПлатёж();

        try {
            app(\Modules\Billing\Services\StubPaymentGateway::class)
                ->handleWebhook(['payment_uuid' => $платёж->uuid]);
            $this->fail('подменный вебхук на проде сработал');
        } catch (PaymentContourUnavailableException) {
            // то, что и ожидается
        }

        $this->assertSame('pending', $платёж->fresh()->status);
    }

    /** Подменный вебхук не трогает платежи других провайдеров. */
    public function test_подменный_вебхук_не_оплачивает_чужой_платёж(): void
    {
        $this->ненастроенныйВтб('auto');
        $втб = $this->подменныйПлатёж('vtb');

        app(\Modules\Billing\Services\StubPaymentGateway::class)
            ->handleWebhook(['payment_uuid' => $втб->uuid]);

        $this->assertSame(
            'pending',
            $втб->fresh()->status,
            'подменный обработчик довёл до оплаты платёж ВТБ',
        );
    }

    /** Остальные точки создания платежа отказывают тем же ответом. */
    public function test_пополнение_кошелька_на_проде_отказывает(): void
    {
        $this->боевоеОкружение();
        $this->ненастроенныйВтб('auto');

        $ответ = $this->actingAs($this->человек(), 'sanctum')
            ->postJson('/api/v1/wallet/topup', ['amount' => 500]);

        $this->assertContains($ответ->status(), [503], 'пополнение не отказало: '.$ответ->status());
        $this->assertContains(
            $ответ->json('code'),
            ['payment_contour_unavailable', 'vtb_required'],
            'код отказа не из платёжного словаря',
        );
    }

    private function подменныйПлатёж(string $провайдер = 'stub'): Payment
    {
        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $this->человек()->id,
            'provider' => $провайдер,
            'status' => 'pending',
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'metadata' => ['payable_type' => 'subscription', 'plan_slug' => 'month'],
        ]);
    }

}
