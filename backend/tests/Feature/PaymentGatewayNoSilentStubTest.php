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
            'billing.vtb.api_url' => null,
            'billing.vtb.username' => null,
            'billing.vtb.password' => null,
            'billing.vtb.token' => null,
        ]);
    }

    private function настроенныйВтб(): void
    {
        config([
            'billing.vtb.enabled' => true,
            // Адрес называется явно: умолчания у него нет, и без адреса шлюз
            // не считается настроенным. Раньше адрес подставляло умолчание, и
            // «настроенный ВТБ» в этой проверке означал «ключи есть».
            'billing.vtb.api_url' => 'https://platezh.vtb24.ru/payment/rest/',
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
        $this->assertFalse($менеджер->stubAllowed());
    }

    /**
     * У денежного адреса нет умолчания — ни испытательного, ни боевого.
     *
     * Эта проверка раньше требовала боевого умолчания
     * (`platezh.vtb24.ru`). Выбрано другое: не подставлять ничего. Разница в
     * том, как они ломаются. Без адреса приём денег отказывает ответом 503
     * «платёжный шлюз не настроен» — причина названа. С боевым умолчанием и
     * испытательными ключами банк отвечает отказом авторизации, и искать
     * будут неполадку у банка, а не незаданную переменную.
     *
     * Проверяется текст конфигурации, а не значение: значение зависит от
     * окружения прогона, а запрет — нет.
     */
    public function test_the_money_address_has_no_default(): void
    {
        $текст = (string) file_get_contents(config_path('billing.php'));

        foreach (['VTB_ACQUIRING_API_URL', 'VTB_PAYOUT_OAUTH_URL', 'VTB_PAYOUT_API_URL'] as $ключ) {
            $this->assertDoesNotMatchRegularExpression(
                '/env\(\s*[\'"]'.preg_quote($ключ, '/').'[\'"]\s*,/',
                $текст,
                'у денежного адреса '.$ключ.' появилось умолчание',
            );
        }

        foreach (['rbsuat', 'epa-ift-sbp', 'test3.api.vtb'] as $узел) {
            foreach (explode("\n", $текст) as $номер => $строка) {
                $обрезанная = ltrim($строка);
                if ($обрезанная === '' || str_starts_with($обрезанная, '|')
                    || str_starts_with($обрезанная, '*') || str_starts_with($обрезанная, '/*')
                    || str_starts_with($обрезанная, '//')) {
                    continue;
                }
                $this->assertStringNotContainsString(
                    $узел,
                    $обрезанная,
                    'испытательный узел в значении, config/billing.php строка '.($номер + 1),
                );
            }
        }
    }
}
