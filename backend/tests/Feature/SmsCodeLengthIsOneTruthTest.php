<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Services\Sms\SmsMessenger;
use App\Services\Sms\SmsTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Mockery;
use Tests\TestCase;

/**
 * Длина кода подтверждения — одно место истины. Решение З1 от 09.10.
 *
 * Жалоба владельца 09.10: «Код приходит из четырёх цифр, а форма требует
 * шесть — подтвердить номер невозможно». В коде на то было две причины, и
 * каждая держалась сама по себе.
 *
 * **Первая.** Код уходил в SMS числом: `sendTemplate(…, [(int) $code])` и
 * `%d` в шаблоне. Приведение к числу съедает ведущие нули, и код `001234`
 * превращался в «1234». Каждый десятый код начинается с нуля, каждый сотый —
 * с двух; то есть один человек из десяти получал код короче, чем ждёт форма,
 * и подтвердить номер не мог вовсе.
 *
 * **Вторая.** Шестёрка была записана в шести местах независимо: генератор,
 * проверка в сервисе, проверка формы запроса, текст отказа и трижды в
 * интерфейсе. Настройка `sms.verification.code_length` при этом существовала
 * и не использовалась ни разу — `grep` по бэкенду давал одну строку, саму
 * настройку. Поменять длину было нельзя: сервер начал бы отвергать
 * собственный код.
 *
 * Эти проверки падают без починки — доказано откатом обеих правок:
 * `test_leading_zeros_survive_the_sms` ловит первую,
 * `test_changing_the_setting_changes_the_whole_chain` — вторую.
 */
class SmsCodeLengthIsOneTruthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('sms.driver', 'log');
        Config::set('sms.verification.resend_cooldown_seconds', 0);
    }

    /**
     * Человек без подтверждённого телефона — иначе проверять нечего.
     *
     * `phone_verified_at` задаётся явно: фабрика по умолчанию ставит дату, и
     * первый вариант этого теста из-за неё утверждал «телефон не подтверждён»
     * о заранее подтверждённом телефоне — то есть не проверял ничего.
     *
     * @return array{0: User, 1: array<string, string>}
     */
    private function actor(): array
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => null,
            'phone_verified_at' => null,
        ]);
        RateLimiter::clear('phone-send:user:'.$user->id);

        return [$user, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]];
    }

    public function test_send_response_tells_the_form_how_many_digits_to_expect(): void
    {
        Config::set('sms.verification.code_length', 6);
        [, $headers] = $this->actor();

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(202)
            // Без этого поля форма знает длину только из своей копии шестёрки,
            // а копия и есть причина жалобы.
            ->assertJsonPath('data.code_length', 6);
    }

    /**
     * Ведущие нули доезжают до человека.
     *
     * Код задаётся нарочно — `random_int` не вызвать с нужным значением, а
     * проверять надо именно текст сообщения.
     */
    public function test_leading_zeros_survive_the_sms(): void
    {
        $text = SmsTemplate::Verification->render(['001234']);

        $this->assertStringContainsString(
            '001234',
            $text,
            'Код с ведущими нулями обрезался в тексте SMS: '.$text,
        );
        $this->assertStringContainsString(
            '001234',
            $text,
            'Код должен быть в SMS строкой с ведущими нулями: '.$text,
        );
        $this->assertStringContainsString('Modelizm:', $text);
    }

    /** Та же ловушка у остальных четырёх шаблонов с кодом. */
    public function test_all_code_templates_keep_leading_zeros(): void
    {
        foreach ([
            SmsTemplate::Verification,
            SmsTemplate::Login,
            SmsTemplate::PasswordReset,
            SmsTemplate::PhoneChange,
            SmsTemplate::AdPublishVerify,
        ] as $template) {
            $this->assertStringContainsString(
                '000123',
                $template->render(['000123']),
                'Шаблон '.$template->value.' съел ведущие нули кода.',
            );
        }
    }

    /**
     * Смена настройки меняет всю цепочку: генерацию, SMS, ответ и проверку.
     *
     * Это и есть «одно место истины»: интерфейс не правится, а поле
     * перестраивается по длине из ответа сервера.
     */
    public function test_changing_the_setting_changes_the_whole_chain(): void
    {
        Config::set('sms.verification.code_length', 7);
        [$user, $headers] = $this->actor();

        $sent = null;
        $this->mock(SmsMessenger::class, function ($mock) use (&$sent): void {
            $mock->shouldReceive('sendTemplate')
                ->andReturnUsing(function (string $phone, SmsTemplate $tpl, array $params) use (&$sent): array {
                    $sent = $tpl->render($params);

                    return ['ok' => true];
                });
        });

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(202)
            ->assertJsonPath('data.code_length', 7);

        $code = PhoneVerificationCode::query()->where('user_id', $user->id)->latest('id')->firstOrFail()->code;

        $this->assertSame(7, strlen($code), 'Генератор не послушал настройку: '.$code);
        $this->assertStringContainsString($code, (string) $sent, 'В SMS уехал не тот код.');

        // Код нужной длины принимается.
        $this->postJson(
            '/api/v1/account/phone/verify',
            ['phone' => '+79001112233', 'code' => $code],
            $headers,
        )->assertStatus(200);

        $this->assertNotNull($user->fresh()->phone_verified_at);
    }

    public function test_code_of_another_length_is_refused(): void
    {
        Config::set('sms.verification.code_length', 6);
        [$user, $headers] = $this->actor();

        $this->postJson('/api/v1/account/phone/send-code', ['phone' => '+79001112233'], $headers)
            ->assertStatus(202);

        $code = PhoneVerificationCode::query()->where('user_id', $user->id)->latest('id')->firstOrFail()->code;

        // Тот же код, но на одну цифру короче — не принимается.
        $this->postJson(
            '/api/v1/account/phone/verify',
            ['phone' => '+79001112233', 'code' => substr($code, 0, 5)],
            $headers,
        )->assertStatus(422);

        $this->assertNull($user->fresh()->phone_verified_at);
    }

    /** Опечатка в настройке не выпускает одноцифровой код. */
    public function test_setting_is_clamped_to_a_sane_range(): void
    {
        Config::set('sms.verification.code_length', 1);
        $this->assertSame(6, \Modules\Auth\Services\PhoneVerificationService::codeLength());

        Config::set('sms.verification.code_length', 99);
        $this->assertSame(8, \Modules\Auth\Services\PhoneVerificationService::codeLength());
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
