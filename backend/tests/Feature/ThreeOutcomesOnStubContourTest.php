<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\User;
use App\Support\PaymentFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Три исхода на тестовом контуре: успех, отказ карты, закрытие формы.
 *
 * По каждому — верный статус и верная причина. Это та проверка, которую
 * просил заказчик, и она идёт через настоящие маршруты, а не через
 * сервис напрямую: между контроллером и сервисом как раз и терялись код
 * с шагом.
 *
 * Закрытие формы отдельным исходом у заглушки нет — и не нужно. Человек,
 * закрывший форму, ничего не нажимает: платёж остаётся висеть, и его
 * закрывает сверка. Поэтому третий исход проверяется так же, как он
 * случается, — прогоном `payments:reconcile-pending`.
 */
class ThreeOutcomesOnStubContourTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('billing.provider', 'stub');
    }

    private function человек(): User
    {
        return User::factory()->create([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function платёж(User $кто, string $статус = 'pending'): Payment
    {
        return Payment::query()->create([
            'uuid' => Str::uuid()->toString(),
            'user_id' => $кто->id,
            'amount_cents' => 19900,
            'currency' => 'RUB',
            'status' => $статус,
            'provider' => 'stub',
            'metadata' => ['payable_type' => 'subscription'],
        ]);
    }

    public function test_исход_первый_успех(): void
    {
        $кто = $this->человек();
        $платёж = $this->платёж($кто);

        $this->actingAs($кто, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/confirm-stub", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $платёж->refresh();

        $this->assertSame('paid', $платёж->status);
        $this->assertNull($платёж->failure_code, 'у оплаченного записана причина отказа');
        $this->assertNotNull($платёж->paid_at, 'время оплаты не записано');
    }

    public function test_исход_второй_отказ_карты(): void
    {
        $кто = $this->человек();
        $платёж = $this->платёж($кто);

        $this->actingAs($кто, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/confirm-stub", ['outcome' => 'insufficient_funds'])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed');

        $платёж->refresh();

        $this->assertSame('failed', $платёж->status);
        $this->assertSame('insufficient_funds', $платёж->failure_code, 'причина не доехала до колонки');
        $this->assertSame(PaymentFailure::STAGE_BANK, $платёж->failure_stage);
        $this->assertNotNull($платёж->failed_at, 'время отказа не записано');
        $this->assertSame(PaymentFailure::BY_USER, $платёж->decided_by);
    }

    public function test_исход_второй_отклонено_банком(): void
    {
        $кто = $this->человек();
        $платёж = $this->платёж($кто);

        $this->actingAs($кто, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/confirm-stub", ['outcome' => 'declined'])
            ->assertOk();

        $платёж->refresh();

        $this->assertSame('declined_by_bank', $платёж->failure_code);
        $this->assertSame(PaymentFailure::STAGE_BANK, $платёж->failure_stage);
    }

    public function test_исход_третий_форму_открыли_и_закрыли(): void
    {
        $кто = $this->человек();
        $платёж = $this->платёж($кто);

        // Ушёл на форму — это и есть «дошло до формы банка» в воронке.
        $this->actingAs($кто, 'sanctum')
            ->postJson("/api/v1/payments/{$платёж->uuid}/form-opened")
            ->assertOk();

        $платёж->refresh();
        $this->assertNotNull($платёж->form_opened_at, 'открытие формы не записано');

        // И ничего не нажал. Закрывает сверка, как на проде.
        $платёж->forceFill(['created_at' => now()->subHour()])->save();
        $this->artisan('payments:reconcile-pending --apply --older-than=15 --provider=stub')
            ->assertSuccessful();

        $платёж->refresh();

        $this->assertSame('abandoned', $платёж->status, 'брошенная форма свалена в отказы — воронка соврёт');
        $this->assertSame('abandoned', $платёж->failure_code);
        $this->assertSame(PaymentFailure::STAGE_FORM, $платёж->failure_stage);
        $this->assertNotNull($платёж->failed_at);
    }

    public function test_воронка_показывает_все_три_исхода(): void
    {
        $владелец = User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);

        /*
         * Воронка умышленно не считает заглушку: на 30.09 в боевой базе
         * 39 «оплат» из 46 были тестовыми. Поэтому для проверки сами
         * строки заводим как платежи ВТБ — считается не способ оплаты, а
         * то, что воронка умеет разложить исходы.
         */
        foreach ([
            ['paid', null, null],
            ['failed', 'insufficient_funds', PaymentFailure::STAGE_BANK],
            ['abandoned', 'abandoned', PaymentFailure::STAGE_FORM],
        ] as [$статус, $код, $шаг]) {
            Payment::query()->create([
                'uuid' => Str::uuid()->toString(),
                'user_id' => $владелец->id,
                'amount_cents' => 19900,
                'currency' => 'RUB',
                'status' => $статус,
                'provider' => 'vtb',
                'failure_code' => $код,
                'failure_stage' => $шаг,
                'failed_at' => $статус === 'paid' ? null : now(),
                'form_opened_at' => now(),
            ]);
        }

        $ответ = $this->actingAs($владелец, 'sanctum')->getJson('/api/v1/admin/payments/funnel');
        $ответ->assertOk();

        $данные = $ответ->json('data');

        $шаги = collect($данные['steps'])->keyBy('key');
        $исходы = collect($данные['outcomes'])->keyBy('key');

        $this->assertSame(3, $шаги['started']['count'], 'воронка не посчитала начатые');
        $this->assertSame(3, $шаги['form']['count'], 'не посчитаны дошедшие до формы');
        $this->assertSame(1, $исходы['paid']['count']);
        $this->assertSame(1, $исходы['failed']['count']);
        // Брошенная форма — свой исход, а не отказ: иначе воронка
        // утверждала бы, что банк отклонил платёж, которого не видел.
        $this->assertSame(1, $исходы['abandoned']['count']);

        $коды = collect($данные['reasons'])->pluck('code')->all();
        $this->assertContains('insufficient_funds', $коды, 'причина отказа не попала в воронку');
        $this->assertTrue($данные['excludes_stub'], 'воронка не говорит, что заглушку не считает');
    }
}
