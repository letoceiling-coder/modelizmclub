<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\PaymentGatewayManager;
use Modules\Billing\Services\SafeDealPayoutService;
use Modules\Billing\Services\VtbPaymentGateway;
use Tests\TestCase;

/**
 * Денежный контур не считается настроенным без названного адреса.
 *
 * До 03.10 умолчанием адреса эквайринга была песочница ВТБ
 * (`https://vtb.rbsuat.com/payment/rest`), у выплат — `epa-ift-sbp.vtb.ru`
 * и `test3.api.vtb.ru:8443`. Выглядело безобидно — «не настроил, значит не
 * боевое», — а работало наоборот: контур с ключами и `enabled=true`
 * считал себя настроенным и слал заказы в испытательный узел.
 *
 * На проде так прошло больше месяца. Снаружи не видно ничем: платёж
 * создаётся, возвращает ссылку, человек видит форму банка и вводит карту.
 * За всю жизнь сервиса прошёл один платёж, и объяснялось это то отказами
 * банка, то поведением людей.
 */
class MoneyGoesWhereToldTest extends TestCase
{
    use RefreshDatabase;

    private function эквайрингСКлючами(?string $адрес): void
    {
        config([
            'billing.provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.api_url' => $адрес,
            'billing.vtb.username' => 'логин',
            'billing.vtb.password' => 'пароль',
            'billing.vtb.token' => null,
        ]);
    }

    public function test_эквайринг_без_адреса_не_настроен(): void
    {
        $this->эквайрингСКлючами(null);

        $this->assertFalse(
            app(VtbPaymentGateway::class)->isConfigured(),
            'эквайринг с ключами и без адреса считает себя настроенным',
        );
    }

    public function test_приём_денег_без_адреса_уходит_на_заглушку_а_не_в_чужой_контур(): void
    {
        $this->эквайрингСКлючами(null);

        // Заглушка видна: /pay/stub — явно не банк. Молчаливый уход в
        // песочницу выглядел бы как работающий приём денег.
        $this->assertSame('stub', app(PaymentGatewayManager::class)->provider());
    }

    public function test_с_названным_адресом_эквайринг_настроен(): void
    {
        $this->эквайрингСКлючами('https://platezh.vtb24.ru/payment/rest/');

        $this->assertTrue(app(VtbPaymentGateway::class)->isConfigured());
        $this->assertSame('vtb', app(PaymentGatewayManager::class)->provider());
    }

    public function test_выплаты_без_адресов_не_настроены(): void
    {
        $базовые = [
            'billing.vtb_payout.enabled' => true,
            'billing.vtb_payout.client_id' => 'ид',
            'billing.vtb_payout.client_secret' => 'секрет',
        ];

        config($базовые + [
            'billing.vtb_payout.oauth_url' => null,
            'billing.vtb_payout.api_url' => 'https://api.vtb.ru:8443/openapi/smb/efcp',
        ]);
        $this->assertFalse(app(SafeDealPayoutService::class)->enabled(), 'без адреса oauth');

        config($базовые + [
            'billing.vtb_payout.oauth_url' => 'https://epa-sbp.vtb.ru/passport/oauth2/token',
            'billing.vtb_payout.api_url' => null,
        ]);
        $this->assertFalse(app(SafeDealPayoutService::class)->enabled(), 'без адреса api');

        config($базовые + [
            'billing.vtb_payout.oauth_url' => 'https://epa-sbp.vtb.ru/passport/oauth2/token',
            'billing.vtb_payout.api_url' => 'https://api.vtb.ru:8443/openapi/smb/efcp',
        ]);
        $this->assertTrue(app(SafeDealPayoutService::class)->enabled(), 'с двумя адресами — настроены');
    }

    /**
     * У денежных адресов нет умолчаний в самой конфигурации.
     *
     * Проверяется текст: значения зависят от окружения прогона, а запрет —
     * нет. Ту же строку сторожит `deploy/scripts/check-no-sandbox-defaults.sh`
     * в воротах CI; здесь она на случай, если ворота обойдут.
     */
    public function test_в_конфигурации_нет_умолчания_на_испытательный_узел(): void
    {
        $текст = file_get_contents(config_path('billing.php'));
        $this->assertNotFalse($текст, 'config/billing.php не прочитался — проверять нечего');

        foreach (explode("\n", $текст) as $номер => $строка) {
            $обрезанная = ltrim($строка);
            // Пояснения трогать нельзя: адрес песочницы в комментарии полезен.
            if ($обрезанная === '' || str_starts_with($обрезанная, '|')
                || str_starts_with($обрезанная, '*') || str_starts_with($обрезанная, '/*')
                || str_starts_with($обрезанная, '//')) {
                continue;
            }

            foreach (['rbsuat', 'epa-ift-sbp', 'test3.api.vtb'] as $узел) {
                $this->assertStringNotContainsString(
                    $узел,
                    $обрезанная,
                    'испытательный узел в значении, config/billing.php строка '.($номер + 1),
                );
            }
        }
    }
}
