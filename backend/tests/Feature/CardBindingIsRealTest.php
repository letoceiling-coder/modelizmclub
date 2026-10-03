<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Account\Services\CardBindingService;
use Modules\Billing\Exceptions\PaymentContourUnavailableException;
use Tests\TestCase;

/**
 * Привязка карты не подменяется поддельной.
 *
 * Провайдер выбирался по платёжному шлюзу, а тот отвечает `stub` или `vtb` —
 * ветки `'yookassa'` он не возвращает никогда. Значит на проде срабатывал
 * `default => startStub`, и «привязка карты» сохраняла visa ****4242.
 *
 * Замерено на проде 03.10: такие строки есть у двух живых людей, вторая от
 * 2 сентября — уже после перехода на боевой шлюз. Человек видит в кабинете
 * карту, которой нет, и может попытаться ей заплатить.
 *
 * Заодно `startYooKassa` был недостижим, хотя ключи ЮKassa на проде боевые, а
 * в `config/billing.php` она прямо названа подсистемой привязки карт.
 */
class CardBindingIsRealTest extends TestCase
{
    use RefreshDatabase;

    private function человек(): User
    {
        return User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    private function yookassaНастроена(bool $да): void
    {
        config([
            'billing.yookassa.enabled' => $да,
            'billing.yookassa.shop_id' => $да ? '1405539' : null,
            'billing.yookassa.secret_key' => $да ? 'live_проверочный' : null,
        ]);
    }

    private function боевойВтб(): void
    {
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.api_url' => 'https://platezh.vtb24.ru/payment/rest/',
            'billing.vtb.username' => 'u',
            'billing.vtb.password' => 'p',
        ]);
    }

    public function test_на_проде_с_настроенной_yookassa_привязка_идёт_к_ней(): void
    {
        $this->app['env'] = 'production';
        $this->боевойВтб();
        $this->yookassaНастроена(true);

        Http::fake([
            '*' => Http::response([
                'id' => 'yk-1',
                'confirmation' => ['confirmation_url' => 'https://yoomoney.ru/checkout/yk-1'],
            ], 200),
        ]);

        $ответ = app(CardBindingService::class)->start($this->человек());

        $this->assertStringContainsString('yoomoney.ru', $ответ['binding_url']);
        // Суть дефекта: раньше здесь был свой адрес с подменным завершением.
        $this->assertStringNotContainsString('payment-methods/bind/complete', $ответ['binding_url']);
    }

    public function test_на_проде_без_yookassa_отказ_а_не_поддельная_карта(): void
    {
        $this->app['env'] = 'production';
        $this->боевойВтб();
        $this->yookassaНастроена(false);

        $this->expectException(PaymentContourUnavailableException::class);

        app(CardBindingService::class)->start($this->человек());
    }

    public function test_вне_прода_подменная_привязка_остаётся(): void
    {
        // Разработка на ней и живёт — запрет только боевой.
        config(['billing.provider' => 'stub']);
        $this->yookassaНастроена(false);

        $ответ = app(CardBindingService::class)->start($this->человек());

        $this->assertStringContainsString('payment-methods/bind/complete', $ответ['binding_url']);
    }

    public function test_поддельная_карта_на_проде_не_сохраняется(): void
    {
        $this->app['env'] = 'production';
        $this->боевойВтб();
        $this->yookassaНастроена(false);
        $человек = $this->человек();

        try {
            app(CardBindingService::class)->start($человек);
            $this->fail('привязка прошла на проде без ЮKassa');
        } catch (PaymentContourUnavailableException) {
            // то, что и ожидается
        }

        $this->assertSame(
            0,
            \App\Models\SavedPaymentMethod::query()->where('user_id', $человек->id)->count(),
            'на проде сохранилась карта',
        );
    }
}
