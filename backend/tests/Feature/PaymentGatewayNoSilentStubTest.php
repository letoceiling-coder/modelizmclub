<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\PaymentGatewayManager;
use Modules\Billing\Services\StubPaymentGateway;
use Modules\Billing\Services\VtbPaymentGateway;
use RuntimeException;
use Tests\TestCase;

/**
 * Тестовый эквайринг не подменяет боевой молча.
 *
 * До 03.10 обе ветки с ВТБ заканчивались `: $this->stub`: ненастроенный шлюз
 * подменялся страницей с выбором исхода «оплачено / нет денег / отказ
 * карты». На проде это означает ненастоящую оплату и настоящую подписку.
 *
 * Дотянуться можно было не опечаткой, а сбоем, который уже случался: 07.09
 * `config:clear` при нечитаемом `.env` обнулил все `env()` — тогда
 * `BILLING_PROVIDER` становится `auto`, а `VTB_ACQUIRING_ENABLED` — `false`.
 */
class PaymentGatewayNoSilentStubTest extends TestCase
{
    use RefreshDatabase;

    private function ненастроенныйВтб(): void
    {
        config([
            'billing.vtb.enabled' => false,
            'billing.vtb.username' => null,
            'billing.vtb.password' => null,
            'billing.vtb.token' => null,
        ]);
    }

    private function настроенныйВтб(): void
    {
        config([
            'billing.vtb.enabled' => true,
            'billing.vtb.username' => 'u',
            'billing.vtb.password' => 'p',
            'billing.vtb.token' => null,
        ]);
    }

    /** `environment()` читает `$this['env']`, а не конфиг, — ставим его явно. */
    private function прод(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
    }

    private function оплатить(): array
    {
        return app(PaymentGatewayManager::class)->createCheckout(
            User::factory()->create(),
            100_00,
            'RUB',
            'Подписка',
        );
    }

    public function test_explicit_vtb_refuses_instead_of_falling_back(): void
    {
        config(['billing.provider' => 'vtb']);
        $this->ненастроенныйВтб();

        $this->expectException(RuntimeException::class);
        $this->оплатить();
    }

    public function test_auto_on_production_refuses(): void
    {
        config(['billing.provider' => 'auto']);
        $this->ненастроенныйВтб();
        $this->прод();

        $this->expectException(RuntimeException::class);
        $this->оплатить();
    }

    public function test_auto_outside_production_still_uses_the_stub(): void
    {
        // Так работает местная разработка, и ломать это незачем.
        config(['billing.provider' => 'auto']);
        $this->ненастроенныйВтб();

        $this->assertSame('stub', $this->оплатить()['provider']);
    }

    public function test_explicit_stub_is_allowed_even_on_production(): void
    {
        // Это написали руками и видно в `.env`. Запрет касается подмены, а не
        // осознанного выбора: до запуска площадка может стоять на подменном
        // контуре нарочно.
        config(['billing.provider' => 'stub']);
        $this->ненастроенныйВтб();
        $this->прод();

        $this->assertSame('stub', $this->оплатить()['provider']);
    }

    public function test_a_configured_vtb_is_chosen_on_production(): void
    {
        config(['billing.provider' => 'auto']);
        $this->настроенныйВтб();
        $this->прод();

        $this->assertInstanceOf(
            VtbPaymentGateway::class,
            app(PaymentGatewayManager::class)->resolve(),
        );
    }

    public function test_reading_the_provider_never_throws(): void
    {
        /*
         * Главная оговорка этой правки. `resolve()` спрашивают не только
         * перед оплатой: `User` зовёт `provider()`, решая, считать ли прошлые
         * подменные платежи настоящими, и это происходит на обычных
         * запросах. Если бы отказ стоял в `resolve()`, настройка оплаты
         * роняла бы сайт целиком.
         */
        config(['billing.provider' => 'auto']);
        $this->ненастроенныйВтб();
        $this->прод();

        $менеджер = app(PaymentGatewayManager::class);

        $this->assertSame('stub', $менеджер->provider());
        $this->assertInstanceOf(StubPaymentGateway::class, $менеджер->resolve());
        $this->assertTrue($менеджер->substitutionForbidden());
    }

    public function test_the_production_contour_is_the_default(): void
    {
        // Умолчание важнее, чем кажется: по разбору стенда 13.07 переменной
        // может не оказаться вовсе, и тогда работает именно оно.
        $умолчание = (string) config('billing.vtb.api_url');

        $this->assertStringContainsString('platezh.vtb24.ru', $умолчание);
        $this->assertStringNotContainsString('rbsuat', $умолчание);
    }
}
