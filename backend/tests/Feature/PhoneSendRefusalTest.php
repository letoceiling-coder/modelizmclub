<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\Sms\SmsDeliveryException;
use App\Services\Sms\SmsFailureReason;
use App\Services\Sms\SmsMessenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Отказы в отправке SMS должны быть различимы.
 *
 * До 06.09 пауза между отправками, взятый предел и отказ оператора отвечали
 * одинаковым 422 с текстом в `errors.phone`. Клиент не мог понять, сколько
 * ждать, поэтому не заводил отсчёт и не блокировал кнопку: человек жал ещё
 * раз, тратил попытку и упирался в предел на десять минут. Логи 05.09
 * показывают ровно это — три отправки, потом три отказа подряд.
 */
class PhoneSendRefusalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('sms.driver', 'log');
        RateLimiter::clear('phone-send:user:1');
    }

    /** @return array{0: User, 1: array<string, string>} */
    private function actor(): array
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        return [$user, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]];
    }

    public function test_successful_send_tells_client_how_long_to_wait(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 60);
        [, $headers] = $this->actor();

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(202)
            // Без этого поля клиенту нечем заводить отсчёт, и он либо
            // не блокирует кнопку, либо хранит свою копию паузы.
            ->assertJsonPath('data.resend_after', 60);
    }

    public function test_cooldown_refusal_carries_code_and_seconds(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 60);
        [, $headers] = $this->actor();

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(202);

        $second = $this->postJson(
            '/api/v1/account/phone/send-code',
            ['phone' => '+79001112233'],
            $headers,
        );

        $second->assertStatus(422)->assertJsonPath('code', 'sms_cooldown');
        $this->assertGreaterThan(0, $second->json('retry_after'));
        // Форма прежняя: текст всё так же лежит в errors.phone.
        $this->assertNotEmpty($second->json('errors.phone.0'));
    }

    public function test_rate_limit_refusal_is_distinct_from_cooldown(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 0);
        Config::set('sms.rate_limits.send_per_user', ['max' => 2, 'decay_minutes' => 10]);
        [, $headers] = $this->actor();

        foreach ([1, 2] as $ignored) {
            $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
                ->assertStatus(202);
        }

        $blocked = $this->postJson(
            '/api/v1/account/phone/send-code',
            ['phone' => '+79001112233'],
            $headers,
        );

        $blocked->assertStatus(422)->assertJsonPath('code', 'sms_rate_limited');
        $this->assertGreaterThan(0, $blocked->json('retry_after'));
    }

    /**
     * Отказ, где шлюз сам назвал номер, — единственный, который говорит о
     * номере.
     *
     * До 09.10 этот тест стоял без причины у исключения и ждал кода
     * `sms_provider_rejected` на **любой** отказ шлюза. Решение Ж5 от 09.10
     * это отменило: причина ставится в драйвере, и «проверьте номер»
     * говорится только там, где шлюз это сказал. Разбор — в
     * `App\Services\Sms\SmsFailureReason`, парный тест —
     * `SmsRefusalDoesNotBlamePersonTest`.
     */
    public function test_provider_rejection_is_not_a_wait_and_says_so(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 0);
        // В local и testing неудачная отправка намеренно не поднимает ошибку:
        // код уходит в лог, чтобы тесты могли его прочитать. Проверяем то,
        // что увидит живой пользователь, поэтому среда здесь боевая.
        $this->app->detectEnvironment(fn () => 'production');
        [, $headers] = $this->actor();

        $this->mock(SmsMessenger::class, function ($mock): void {
            $mock->shouldReceive('sendTemplate')
                ->andThrow(new SmsDeliveryException(
                    'iqsms message rejected: invalid mobile phone',
                    SmsFailureReason::BadNumber,
                ));
        });

        $response = $this->postJson(
            '/api/v1/account/phone/send-code',
            ['phone' => '+79001112233'],
            $headers,
        );

        $response->assertStatus(422)->assertJsonPath('code', 'sms_provider_rejected');
        // Срока нет: ждать бессмысленно, оператор не примет этот номер и позже.
        // Клиент по этому признаку не блокирует кнопку, а возвращает к вводу.
        $this->assertNull($response->json('retry_after'));
        $this->assertStringContainsString('номер', (string) $response->json('errors.phone.0'));
    }

    /**
     * Отказ без объяснения о номере не говорит — решение Ж5.
     *
     * Это та же форма отказа, что стояла в тесте выше до 09.10: исключение
     * без причины. Теперь оно значит «мы не знаем», и человек читает, что
     * дело в сервисе, а не в его номере.
     */
    public function test_unexplained_provider_rejection_does_not_blame_the_number(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 0);
        $this->app->detectEnvironment(fn () => 'production');
        [, $headers] = $this->actor();

        $this->mock(SmsMessenger::class, function ($mock): void {
            $mock->shouldReceive('sendTemplate')
                ->andThrow(new SmsDeliveryException('iqsms отклонил отправку'));
        });

        $response = $this->postJson(
            '/api/v1/account/phone/send-code',
            ['phone' => '+79001112233'],
            $headers,
        );

        $response->assertStatus(422)->assertJsonPath('code', 'sms_service_unavailable');
        $this->assertNull($response->json('retry_after'));
        $this->assertStringNotContainsString(
            'номер',
            mb_strtolower((string) $response->json('errors.phone.0')),
        );
    }

    public function test_provider_rejection_does_not_consume_an_attempt(): void
    {
        Config::set('sms.verification.resend_cooldown_seconds', 0);
        Config::set('sms.rate_limits.send_per_user', ['max' => 2, 'decay_minutes' => 10]);
        $this->app->detectEnvironment(fn () => 'production');
        [, $headers] = $this->actor();

        // Падает только первая отправка, дальше оператор отвечает нормально.
        $calls = 0;
        $this->mock(SmsMessenger::class, function ($mock) use (&$calls): void {
            $mock->shouldReceive('sendTemplate')->andReturnUsing(function () use (&$calls): array {
                $calls++;
                if ($calls === 1) {
                    throw new SmsDeliveryException('iqsms отклонил номер');
                }

                return [];
            });
        });

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(422);

        // Неудачная отправка не должна списывать попытку: человек не получил
        // ничего, а предел уже приблизился бы на шаг.
        foreach ([1, 2] as $ignored) {
            $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
                ->assertStatus(202);
        }
    }
}
