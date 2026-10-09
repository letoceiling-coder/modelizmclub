<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Sms\SmsDeliveryException;
use App\Services\Sms\SmsFailureJournal;
use App\Services\Sms\SmsFailureReason;
use App\Services\Sms\SmsMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Отказ отправки SMS не обвиняет человека, если причина у нас.
 *
 * Решение Ж5 от 09.10. На снимке владельца номер +7 938 410-00-24 записан
 * верно, а сервис ответил: «Оператор связи отклонил отправку на этот номер.
 * Проверьте номер или укажите другой». Эта фраза стояла **на все случаи** —
 * нет ключей шлюза, не согласована подпись отправителя, кончились деньги,
 * шлюз не ответил, провайдер отклонил конкретный номер. Человек с верным
 * номером читал, что номер неверный.
 *
 * Прогон идёт по настоящему пути отправки: подменяется только шлюз
 * (`SmsMessenger`), остальное — боевой код контроллера и службы.
 */
class SmsRefusalDoesNotBlamePersonTest extends TestCase
{
    use RefreshDatabase;

    private function отказать(SmsFailureReason $причина, string $текст = 'тех. текст'): void
    {
        $this->mock(SmsMessenger::class, function ($mock) use ($причина, $текст) {
            $mock->shouldReceive('sendTemplate')
                ->andThrow(new SmsDeliveryException($текст, $причина));
        });
    }

    private function пользователь(): User
    {
        return User::factory()->create(['phone' => null, 'phone_verified_at' => null]);
    }

    /**
     * Среда прогона — `testing`, а в ней служба нарочно не отказывает, а
     * пишет код в журнал: иначе на стенде нельзя было бы подтвердить телефон
     * вообще. Поэтому для проверки текста среда переключается на боевую.
     */
    private function какНаПроде(): void
    {
        app()->detectEnvironment(fn () => 'production');
    }

    public function test_нет_ключей_шлюза_человек_не_виноват(): void
    {
        $this->какНаПроде();
        $this->отказать(SmsFailureReason::NotConfigured, 'SMS credentials are not configured.');

        $ответ = $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024']);

        $ответ->assertStatus(422)
            ->assertJsonPath('code', 'sms_service_unavailable')
            ->assertJsonPath(
                'message',
                'Сейчас не получается отправить код. Попробуйте позже или напишите в поддержку.',
            );

        $this->assertStringNotContainsString(
            'номер',
            mb_strtolower((string) $ответ->json('message')),
            'причина у нас, а в тексте речь о номере человека',
        );
    }

    public function test_шлюз_не_ответил_человек_не_виноват(): void
    {
        $this->какНаПроде();
        $this->отказать(SmsFailureReason::GatewayUnavailable, 'iqsms HTTP 502: bad gateway');

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'sms_service_unavailable');
    }

    public function test_шлюз_отказал_без_объяснения_человек_не_виноват(): void
    {
        // Неизвестная причина считается нашей: чтобы сказать «проверьте
        // номер», нужно доказательство.
        $this->какНаПроде();
        $this->отказать(SmsFailureReason::GatewayRefused, 'iqsms error: {"status":"error"}');

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'sms_service_unavailable');
    }

    public function test_только_отказ_по_номеру_говорит_про_номер(): void
    {
        $this->какНаПроде();
        $this->отказать(SmsFailureReason::BadNumber, 'iqsms message rejected: invalid mobile phone');

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'sms_provider_rejected')
            ->assertJsonPath(
                'message',
                'Оператор связи отклонил отправку на этот номер. Проверьте номер или укажите другой.',
            );
    }

    public function test_отказ_не_блокирует_кнопку_сроком(): void
    {
        // Ждать нечего ни в одном из случаев: либо правь номер, либо дело в
        // нас. Поэтому `retry_after` пуст, и клиент не заводит отсчёт.
        $this->какНаПроде();
        $this->отказать(SmsFailureReason::NotConfigured);

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024'])
            ->assertStatus(422)
            ->assertJsonPath('retry_after', null);
    }

    public function test_отказ_записывается_для_админки(): void
    {
        Cache::flush();
        $this->отказать(SmsFailureReason::NotConfigured, 'SMS sender name is not configured.');

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024']);

        $запись = app(SmsFailureJournal::class)->last();

        $this->assertNotNull($запись, 'отказ не записан — владелец о нём не узнает');
        $this->assertSame('not_configured', $запись['reason']);
        $this->assertTrue($запись['our_fault']);
        $this->assertNotSame('', (string) $запись['hint']);
    }

    public function test_в_записи_для_админки_нет_номера(): void
    {
        Cache::flush();
        // Шлюзы возвращают номер получателя в теле ответа, и оно уходит в
        // сообщение исключения целиком. В админке чужой телефон не нужен.
        $this->отказать(
            SmsFailureReason::GatewayRefused,
            'iqsms message rejected for +79384100024: blocked',
        );

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024']);

        $запись = app(SmsFailureJournal::class)->last();

        $this->assertStringNotContainsString('9384100024', (string) $запись['technical']);
        $this->assertStringContainsString('<номер>', (string) $запись['technical']);
    }

    public function test_успешная_отправка_ничего_не_записывает(): void
    {
        Cache::flush();
        $this->mock(SmsMessenger::class, function ($mock) {
            $mock->shouldReceive('sendTemplate')->andReturn(['ok' => true]);
        });

        $this->actingAs($this->пользователь())
            ->postJson('/api/v1/account/phone/send-code', ['phone' => '+79384100024'])
            ->assertSuccessful();

        $this->assertNull(app(SmsFailureJournal::class)->last());
    }
}
