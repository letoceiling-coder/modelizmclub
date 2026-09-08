<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Payment;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Разбор висящих pending-платежей.
 *
 * Проверяется на подменённом банке: живой опрос 44 боевых заказов в тесте
 * недопустим, а именно от ответа банка зависит каждое решение команды.
 *
 * Главное, что здесь закреплено, — команда без `--apply` не меняет ничего, и
 * оплаченный заказ не хоронится, а доводится до конца: под `pending` может
 * лежать оплата, о которой потерялось уведомление, и удаление вслепую стоило
 * бы человеку выданной, но неучтённой подписки.
 */
class ReconcilePendingPaymentsTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Payer',
            'slug' => 'payer-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function pending(User $user, ?string $orderId, int $daysAgo = 3, string $provider = 'vtb'): Payment
    {
        $payment = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 99000,
            'currency' => 'RUB',
            'status' => 'pending',
            'provider' => $provider,
            'provider_payment_id' => $orderId,
            'idempotency_key' => (string) Str::uuid(),
            'metadata' => ['payable_type' => 'wallet_topup'],
        ]);

        // Дату создания Eloquent ставит сам, а команда отбирает по возрасту:
        // без этой строки все платежи в тесте оказываются «только что» и в
        // выборку не попадают.
        $payment->forceFill([
            'created_at' => now()->subDays($daysAgo),
            'updated_at' => now()->subDays($daysAgo),
        ])->save();

        return $payment->fresh();
    }

    /** Ответ банка по номеру заказа. */
    private function bankSays(array $byOrderId): void
    {
        config(['billing.vtb.api_url' => 'https://bank.test/']);
        config(['billing.vtb.token' => 'test-token']);

        Http::fake(function ($request) use ($byOrderId) {
            parse_str((string) $request->body(), $params);
            $orderId = (string) ($params['orderId'] ?? '');

            return Http::response($byOrderId[$orderId] ?? ['errorCode' => '6', 'errorMessage' => 'Order not found']);
        });
    }

    public function test_without_apply_nothing_changes(): void
    {
        $user = $this->seedUser();
        $paid = $this->pending($user, 'order-paid');
        $this->bankSays(['order-paid' => ['errorCode' => '0', 'orderStatus' => 2]]);

        $this->artisan('payments:reconcile-pending --delay-ms=0')
            ->expectsOutputToContain('оплачен банком')
            ->assertSuccessful();

        $this->assertSame('pending', $paid->fresh()->status);
    }

    public function test_paid_order_is_completed_not_buried(): void
    {
        $user = $this->seedUser();
        $paid = $this->pending($user, 'order-paid');
        $this->bankSays(['order-paid' => ['errorCode' => '0', 'orderStatus' => 2]]);

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0')->assertSuccessful();

        $this->assertSame('paid', $paid->fresh()->status);
    }

    public function test_cancelled_and_unknown_orders_are_closed(): void
    {
        $user = $this->seedUser();
        $cancelled = $this->pending($user, 'order-cancelled');
        $unknown = $this->pending($user, 'order-gone');
        $neverSent = $this->pending($user, null);

        $this->bankSays([
            'order-cancelled' => ['errorCode' => '0', 'orderStatus' => 3],
            // 'order-gone' не описан — подмена ответит «Order not found».
        ]);

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0')->assertSuccessful();

        $this->assertSame('failed', $cancelled->fresh()->status);
        $this->assertSame('failed', $unknown->fresh()->status);
        $this->assertSame('failed', $neverSent->fresh()->status);
    }

    public function test_open_order_is_left_alone(): void
    {
        // orderStatus 0 — заказ создан, человек ещё не платил. Он может
        // вернуться и оплатить; закрывать такой заказ рано.
        $user = $this->seedUser();
        $open = $this->pending($user, 'order-open');
        $this->bankSays(['order-open' => ['errorCode' => '0', 'orderStatus' => 0]]);

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0')
            ->expectsOutputToContain('заказ открыт, оплата не начата')
            ->assertSuccessful();

        $this->assertSame('pending', $open->fresh()->status);
    }

    public function test_unreachable_bank_leaves_the_payment_alone(): void
    {
        // Оборванная сеть — не приговор заказу. Закрыть его здесь значило бы
        // похоронить оплату из-за собственного сбоя.
        $user = $this->seedUser();
        $payment = $this->pending($user, 'order-timeout');
        config(['billing.vtb.api_url' => 'https://bank.test/', 'billing.vtb.token' => 'test-token']);
        Http::fake(fn () => Http::response('gateway timeout', 504));

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0')
            ->expectsOutputToContain('опросить не удалось')
            ->assertSuccessful();

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_stub_payments_are_not_asked_of_the_bank(): void
    {
        // 08.09 команда спрашивала ВТБ про номера вида `stub-…`, которых там
        // нет по определению, и складывала их в «банк не знает».
        $user = $this->seedUser();
        $stub = $this->pending($user, 'stub-'.Str::uuid(), 3, 'stub');
        config(['billing.vtb.api_url' => 'https://bank.test/', 'billing.vtb.token' => 'test-token']);
        Http::fake(fn () => Http::response(['errorCode' => '6', 'errorMessage' => 'Order not found']));

        $this->artisan('payments:reconcile-pending --delay-ms=0')
            ->expectsOutputToContain('тестовый контур, оплата не подтверждена')
            ->assertSuccessful();

        Http::assertNothingSent();
        $this->assertSame('pending', $stub->fresh()->status);
    }

    public function test_stub_payment_with_a_fulfilment_trace_is_left_for_a_human(): void
    {
        // Проводка в кошельке есть, а платёж висит: разошлись статус и факт.
        // Повторный markPaid выдал бы исполнение второй раз, поэтому такой
        // случай только показывается.
        $user = $this->seedUser();
        $stub = $this->pending($user, 'stub-'.Str::uuid(), 3, 'stub');
        $wallet = app(WalletService::class)->wallet($user);
        DB::table('wallet_transactions')->insert([
            'wallet_id' => $wallet->id,
            'user_id' => $user->id,
            'type' => WalletTransactionType::Topup->value,
            'amount_kopecks' => 99000,
            'balance_before' => 0,
            'balance_after' => 99000,
            'ref_type' => 'payment',
            'ref_id' => $stub->id,
            'idempotency_key' => 'topup:'.$stub->id,
            'description' => 'Пополнение баланса',
            'created_at' => now(),
        ]);

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0')
            ->expectsOutputToContain('статус отстал')
            ->assertSuccessful();

        $this->assertSame('pending', $stub->fresh()->status);
    }

    public function test_rate_limited_order_is_retried_and_answered(): void
    {
        // 429 — не ответ, а просьба подождать. Первый запрос отбивается по
        // частоте, второй проходит: заказ обязан попасть в свой исход, а не
        // в «опросить не удалось», как было со всеми двадцатью семью 08.09.
        $user = $this->seedUser();
        $payment = $this->pending($user, 'order-busy');
        config(['billing.vtb.api_url' => 'https://bank.test/', 'billing.vtb.token' => 'test-token']);

        $calls = 0;
        Http::fake(function () use (&$calls) {
            $calls++;

            return $calls === 1
                ? Http::response('too many requests', 429)
                : Http::response(['errorCode' => '0', 'orderStatus' => 2]);
        });

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0 --retries=2')
            ->expectsOutputToContain('оплачен банком')
            ->assertSuccessful();

        $this->assertSame(2, $calls);
        $this->assertSame('paid', $payment->fresh()->status);
    }

    public function test_rate_limit_that_never_lets_up_is_not_a_verdict(): void
    {
        // Если частота не отпускает и после повторов, состояние осталось
        // неизвестным. Закрывать заказ нельзя.
        $user = $this->seedUser();
        $payment = $this->pending($user, 'order-busy-forever');
        config(['billing.vtb.api_url' => 'https://bank.test/', 'billing.vtb.token' => 'test-token']);
        Http::fake(fn () => Http::response('too many requests', 429));

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0 --retries=1')
            ->expectsOutputToContain('опросить не удалось')
            ->assertSuccessful();

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_fresh_payments_are_out_of_scope(): void
    {
        // Платёж, созданный минуту назад, ещё в полёте: человек прямо сейчас
        // на странице банка.
        $user = $this->seedUser();
        $fresh = $this->pending($user, 'order-fresh', 0);
        $this->bankSays(['order-fresh' => ['errorCode' => '0', 'orderStatus' => 3]]);

        $this->artisan('payments:reconcile-pending --apply --delay-ms=0 --older-than=15')
            ->expectsOutputToContain('Висящих платежей нет.')
            ->assertSuccessful();

        $this->assertSame('pending', $fresh->fresh()->status);
    }
}
