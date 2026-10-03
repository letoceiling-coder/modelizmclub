<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Support\PaymentFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Истёкший срок переносится в «брошено», и ничего больше.
 *
 * 03.10 разбор показал: у всех 27 отказов ЮKassa причина
 * `expired_on_confirmation` — человек не подтвердил платёж. Банк отказа
 * не выносил. Пока такие строки лежат в «отказано», воронка говорит
 * «банк отклоняет всем», а это неправда.
 */
class ExpiredAreAbandonedTest extends TestCase
{
    /*
     * `--force` в прогонах с `--apply` появился 03.10 вместе с
     * `GuardsDataWrites`: команда теперь спрашивает перед записью, и без
     * этого довода `confirmToProceed()` ждёт ответа, которого в тесте нет.
     * Довод оставлен видимым нарочно — он и есть тот интерфейс, которым
     * команду зовут из скрипта.
     */

    use RefreshDatabase;

    private function платёж(array $patch = []): Payment
    {
        return Payment::query()->create(array_merge([
            'uuid' => Str::uuid()->toString(),
            'user_id' => User::factory()->create()->id,
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'status' => 'failed',
            'provider' => 'yookassa',
            'provider_payment_id' => 'p-'.Str::random(8),
            'failure_code' => 'expired',
            'failure_stage' => PaymentFailure::STAGE_FORM,
            'failed_at' => now()->subMonth(),
        ], $patch));
    }

    public function test_сухой_прогон_ничего_не_пишет(): void
    {
        $p = $this->платёж();

        $this->artisan('payments:expired-are-abandoned')
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $this->assertSame('failed', $p->fresh()->status);
    }

    public function test_переносит_только_истёкшие(): void
    {
        $истёк = $this->платёж();
        $отказ = $this->платёж(['failure_code' => 'insufficient_funds', 'failure_stage' => PaymentFailure::STAGE_BANK]);
        $оплачен = $this->платёж(['status' => 'paid', 'failure_code' => null, 'failure_stage' => null]);

        $this->artisan('payments:expired-are-abandoned --apply --force')->assertSuccessful();

        $this->assertSame('abandoned', $истёк->fresh()->status);
        $this->assertSame(PaymentFailure::STAGE_FORM, $истёк->fresh()->failure_stage);
        // Отказ банка остаётся отказом: его банк действительно вынес.
        $this->assertSame('failed', $отказ->fresh()->status);
        $this->assertSame('paid', $оплачен->fresh()->status, 'тронут оплаченный платёж');
    }

    public function test_деньги_не_двигаются(): void
    {
        $p = $this->платёж();
        $было = [$p->amount_cents, $p->paid_at, $p->provider_payment_id];

        $this->artisan('payments:expired-are-abandoned --apply --force')->assertSuccessful();
        $p->refresh();

        $this->assertSame($было, [$p->amount_cents, $p->paid_at, $p->provider_payment_id]);
    }

    public function test_повторный_прогон_ничего_не_находит(): void
    {
        $this->платёж();
        $this->artisan('payments:expired-are-abandoned --apply --force')->assertSuccessful();

        $this->artisan('payments:expired-are-abandoned')
            ->expectsOutputToContain('Переносить нечего')
            ->assertSuccessful();
    }

    public function test_отбор_по_провайдеру(): void
    {
        $ю = $this->платёж(['provider' => 'yookassa']);
        $втб = $this->платёж(['provider' => 'vtb']);

        $this->artisan('payments:expired-are-abandoned --apply --force --provider=yookassa')->assertSuccessful();

        $this->assertSame('abandoned', $ю->fresh()->status);
        $this->assertSame('failed', $втб->fresh()->status, 'тронут чужой провайдер');
    }
}
