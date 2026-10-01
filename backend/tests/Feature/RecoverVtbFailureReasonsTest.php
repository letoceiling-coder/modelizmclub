<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Support\PaymentFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbAcquiringClient;
use Tests\TestCase;

/**
 * Восстановление причины отказа по старым платежам ВТБ.
 *
 * На 01.10 у всех 54 настоящих отказов в боевой базе одна и та же
 * причина — фраза, которую написала наша же сверка. Код банка до 30.09
 * не читался нигде. Заказы в банке зарегистрированы, и банк до сих пор
 * отвечает по ним, — значит причину можно вернуть.
 *
 * Команда спрашивает банк и заполняет код, текст и шаг. Деньги она не
 * трогает: статус остаётся прежним, и это проверяется отдельно.
 */
class RecoverVtbFailureReasonsTest extends TestCase
{
    use RefreshDatabase;

    private function платёж(array $patch = []): Payment
    {
        return Payment::query()->create(array_merge([
            'uuid' => Str::uuid()->toString(),
            'user_id' => User::factory()->create()->id,
            'amount_cents' => 10000,
            'currency' => 'RUB',
            'status' => 'failed',
            'provider' => 'vtb',
            'provider_payment_id' => 'ORDER-'.Str::random(6),
            'failure_stage' => PaymentFailure::STAGE_UNKNOWN,
            'failed_at' => now()->subDays(20),
        ], $patch));
    }

    /** @param array<string, array<string, mixed>> $ответы orderId → ответ банка */
    private function банкОтвечает(array $ответы, ?int &$обращений = null): void
    {
        $счётчик = 0;
        $this->app->instance(VtbAcquiringClient::class, new class($ответы, $счётчик) extends VtbAcquiringClient
        {
            public function __construct(private array $ответы, public int &$счётчик) {}

            public function getOrderStatusExtended(string $orderId): array
            {
                $this->счётчик++;

                if (! array_key_exists($orderId, $this->ответы)) {
                    throw new \RuntimeException("банк не знает заказ {$orderId}");
                }

                return $this->ответы[$orderId];
            }
        });
        $обращений = &$счётчик;
    }

    public function test_сухой_прогон_не_спрашивает_банк_и_не_пишет(): void
    {
        $платёж = $this->платёж();
        // Любое обращение к банку уронит подменённого клиента: ответов нет.
        $this->банкОтвечает([]);

        $this->artisan('payments:recover-vtb-reasons')
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $платёж->refresh();
        $this->assertNull($платёж->failure_code, 'сухой прогон записал причину');
        $this->assertSame(PaymentFailure::STAGE_UNKNOWN, $платёж->failure_stage);
    }

    public function test_причина_берётся_из_кода_банка(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => 116,
                'actionCodeDescription' => 'Недостаточно средств на карте',
            ],
        ]);

        $this->artisan('payments:recover-vtb-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('insufficient_funds', $платёж->failure_code);
        $this->assertSame('Недостаточно средств на карте', $платёж->failure_message);
        $this->assertSame(PaymentFailure::STAGE_BANK, $платёж->failure_stage);
        $this->assertSame(PaymentFailure::BY_RECONCILE, $платёж->decided_by);
        // Решение не пересматривается — меняется только его причина.
        $this->assertSame('failed', $платёж->status);
    }

    public function test_истёкший_срок_это_брошенная_форма_а_не_отказ_банка(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => -2007,
                'actionCodeDescription' => 'Истёк срок заказа',
            ],
        ]);

        $this->artisan('payments:recover-vtb-reasons --apply --delay-ms=0')->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('expired', $платёж->failure_code);
        $this->assertSame(
            PaymentFailure::STAGE_FORM,
            $платёж->failure_stage,
            'истёкший срок записан как отказ банка — банк такого платежа не видел',
        );
    }

    public function test_банк_говорит_оплачен_строка_пропускается(): void
    {
        $платёж = $this->платёж();
        $this->банкОтвечает([
            $платёж->provider_payment_id => ['orderStatus' => 2, 'actionCode' => 0],
        ]);

        $this->artisan('payments:recover-vtb-reasons --apply --delay-ms=0')
            ->expectsOutputToContain('разберите отдельно')
            ->assertSuccessful();

        $платёж->refresh();
        $this->assertSame('failed', $платёж->status, 'расхождение по деньгам правлено пакетом');
        $this->assertNull($платёж->failure_code, 'причина записана поверх расхождения');
    }

    public function test_молчание_банка_не_останавливает_остальных(): void
    {
        $молчит = $this->платёж();
        $отвечает = $this->платёж();
        $this->банкОтвечает([
            $отвечает->provider_payment_id => [
                'orderStatus' => 6,
                'actionCode' => 119,
                'actionCodeDescription' => 'Отказ банка',
            ],
        ]);

        $this->artisan('payments:recover-vtb-reasons --apply --delay-ms=0')
            ->expectsOutputToContain('банк не ответил')
            ->assertSuccessful();

        $this->assertNull($молчит->fresh()->failure_code);
        $this->assertSame('declined_by_bank', $отвечает->fresh()->failure_code);
    }

    public function test_выборка_не_трогает_чужого(): void
    {
        $уже = $this->платёж(['failure_code' => 'declined_by_bank', 'failure_message' => 'было']);
        $оплачен = $this->платёж(['status' => 'paid']);
        $чужой = $this->платёж(['provider' => 'yookassa']);
        $безЗаказа = $this->платёж(['provider_payment_id' => null]);

        $this->банкОтвечает([]);

        $this->artisan('payments:recover-vtb-reasons')
            ->expectsOutputToContain('Платежей без восстановимой причины нет')
            ->assertSuccessful();

        $this->assertSame('declined_by_bank', $уже->fresh()->failure_code, 'записанная причина перезаписана');
        $this->assertSame('paid', $оплачен->fresh()->status);
        $this->assertNull($чужой->fresh()->failure_code);
        $this->assertNull($безЗаказа->fresh()->failure_code);
    }

    public function test_брошенные_тоже_восстанавливаются(): void
    {
        // `abandoned` — тоже закрытый платёж без причины: у него код банка
        // может объяснить, форму закрыли или срок истёк.
        $платёж = $this->платёж(['status' => 'abandoned']);
        $this->банкОтвечает([
            $платёж->provider_payment_id => ['orderStatus' => 6, 'actionCode' => -2007],
        ]);

        $this->artisan('payments:recover-vtb-reasons --apply --delay-ms=0')->assertSuccessful();

        $this->assertSame('expired', $платёж->fresh()->failure_code);
        $this->assertSame('abandoned', $платёж->fresh()->status);
    }
}
