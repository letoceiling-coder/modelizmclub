<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Sms\IqSmsClient;
use App\Services\Sms\LogSmsClient;
use App\Services\Sms\MtsMarketologSmsClient;
use App\Services\Sms\SmsDiscountClient;
use App\Services\Sms\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * Сменный SMS-провайдер (D3).
 *
 * Второй шлюз должен подключаться настройкой. Раньше выбор стоял
 * перечислением в AppServiceProvider: третий провайдер означал правку
 * кода, а опечатка в `SMS_DRIVER` молча уводила отправку в iqsms.
 */
class SmsDriverRegistryTest extends TestCase
{
    use RefreshDatabase;

    public function test_каждое_имя_из_реестра_даёт_свой_клиент(): void
    {
        foreach ([
            'iqsms' => IqSmsClient::class,
            'mts' => MtsMarketologSmsClient::class,
            'smsdiscount' => SmsDiscountClient::class,
            'log' => LogSmsClient::class,
        ] as $имя => $класс) {
            Config::set('sms.driver', $имя);
            $this->app->forgetInstance(SmsSender::class);

            $this->assertInstanceOf($класс, $this->app->make(SmsSender::class), "драйвер «{$имя}»");
        }
    }

    /**
     * Опечатка не должна означать «шлём прежним шлюзом».
     *
     * До D3 `default` в `match` подставлял iqsms: `SMS_DRIVER=log`,
     * описанный в настройках, обработчика не имел и слал настоящие
     * сообщения — молча и за деньги.
     */
    public function test_неизвестное_имя_отказывает_а_не_подставляет_первый_попавшийся(): void
    {
        Config::set('sms.driver', 'опечатка');
        $this->app->forgetInstance(SmsSender::class);

        $this->expectException(InvalidArgumentException::class);
        $this->app->make(SmsSender::class);
    }

    /** Новый провайдер — строка в реестре, а не правка выбора. */
    public function test_провайдер_добавляется_настройкой(): void
    {
        Config::set('sms.drivers.выдуманный', LogSmsClient::class);
        Config::set('sms.driver', 'выдуманный');
        $this->app->forgetInstance(SmsSender::class);

        $this->assertInstanceOf(LogSmsClient::class, $this->app->make(SmsSender::class));
    }

    /** Драйвер `log` ничего не отправляет и не требует доступов. */
    public function test_log_ничего_не_шлёт(): void
    {
        Config::set('sms.driver', 'log');
        $this->app->forgetInstance(SmsSender::class);

        $итог = $this->app->make(SmsSender::class)->send('+79001112233', 'проверка');

        $this->assertSame(['status' => 'logged'], $итог);
    }

    /**
     * Отказ по маршрутному ограничителю говорит на том же языке, что и
     * остальные отказы.
     *
     * Человек, нажавший кнопку семь раз за минуту, получал шесть отказов
     * «ждите 60 секунд», а затем 429 — ещё на 60, отсчитанных заново, и
     * без кода и срока в теле. Клиент разбирал только 422, показывал ноль
     * и разблокировал кнопку, пока сервер ещё отказывал.
     */
    public function test_отказ_маршрутного_ограничителя_несёт_код_и_срок(): void
    {
        Config::set('sms.driver', 'log');
        Config::set('sms.verification.resend_cooldown_seconds', 60);
        $user = User::factory()->create(['status' => UserStatus::Active]);
        $h = ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];

        $ответ = null;
        for ($i = 1; $i <= 8; $i++) {
            $ответ = $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $h);
            if ($ответ->status() === 429) {
                break;
            }
        }

        $this->assertSame(429, $ответ->status(), 'маршрутный ограничитель не сработал');
        $this->assertSame('sms_rate_limited', $ответ->json('code'));
        $this->assertGreaterThan(0, $ответ->json('retry_after'));
        $this->assertNotEmpty($ответ->json('errors.phone.0'));
    }
}
