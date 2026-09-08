<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\PaymentFulfillmentService;
use Tests\TestCase;

/**
 * Автоопрос банка: платёж доводится до конца без колбэка.
 *
 * Это разбор случая 11.08. Пользователь 606 трижды за четыре минуты довёл
 * оплату до конца на странице банка, и трижды на сайте ничего не появилось:
 * уведомление банка не дошло, а спросить банк было некому. Деньги нашлись
 * через месяц, разбором вручную.
 *
 * Поэтому здесь колбэк не приходит нарочно. Проверяется, что оплату доводит
 * до конца опрос — и что он при этом не отнимает уже оплаченного.
 */
class PaymentAutoPollTest extends TestCase
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

    private function seedPlan(string $slug = 'month', int $days = 30): SubscriptionPlan
    {
        return SubscriptionPlan::query()->updateOrCreate(
            ['slug' => $slug],
            ['name' => $slug, 'price_cents' => 9900, 'period_days' => $days, 'is_active' => true, 'sort_order' => 1],
        );
    }

    /**
     * Платёж, зависший в `pending`: заказ у банка есть, ответа мы не получили.
     */
    private function pending(User $user, string $orderId, int $minutesAgo, array $metadata): Payment
    {
        $payment = Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => 9900,
            'currency' => 'RUB',
            'status' => 'pending',
            'provider' => 'vtb',
            'provider_payment_id' => $orderId,
            'idempotency_key' => (string) Str::uuid(),
            'metadata' => $metadata,
        ]);

        $payment->forceFill([
            'created_at' => now()->subMinutes($minutesAgo),
            'updated_at' => now()->subMinutes($minutesAgo),
        ])->save();

        return $payment->fresh();
    }

    /** Банк отвечает по номеру заказа; всё остальное — «заказ не найден». */
    private function bankSays(array $byOrderId): void
    {
        config(['billing.vtb.api_url' => 'https://bank.test/', 'billing.vtb.token' => 'test-token']);

        Http::fake(function ($request) use ($byOrderId) {
            parse_str((string) $request->body(), $params);

            return Http::response($byOrderId[(string) ($params['orderId'] ?? '')]
                ?? ['errorCode' => '6', 'errorMessage' => 'Order not found']);
        });
    }

    /** Ровно те ключи, с которыми команда стоит в расписании. */
    private function runAutoPoll(): int
    {
        return $this->artisan('payments:reconcile-pending', [
            '--apply' => true,
            '--provider' => 'vtb',
            '--older-than' => (int) config('billing.auto_poll.older_than_minutes'),
            '--newer-than' => (int) config('billing.auto_poll.newer_than_minutes'),
            '--limit' => (int) config('billing.auto_poll.limit'),
            '--only' => (string) config('billing.auto_poll.apply'),
            '--delay-ms' => 0,
        ])->run();
    }

    public function test_auto_poll_finishes_a_paid_subscription_whose_callback_never_arrived(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();
        $payment = $this->pending($user, 'ORDER-PAID', 30, ['plan_id' => $plan->id]);

        $this->bankSays(['ORDER-PAID' => ['orderStatus' => 2, 'paymentAmountInfo' => ['paymentState' => 'DEPOSITED']]]);

        $this->assertSame(0, $this->runAutoPoll());

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertTrue($user->fresh()->hasActiveSubscription());
        $this->assertDatabaseHas('user_subscriptions', [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
        ]);
    }

    public function test_auto_poll_does_not_reach_back_past_its_window(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();

        // Месяц назад — за верхней границей окна. Такие платежи разбираются
        // руками: в них лежат решения о деньгах, а не потерянные колбэки.
        $old = $this->pending($user, 'ORDER-OLD', 60 * 24 * 30, ['plan_id' => $plan->id]);

        $this->bankSays(['ORDER-OLD' => ['orderStatus' => 2]]);

        $this->runAutoPoll();

        $this->assertSame('pending', $old->fresh()->status);
        $this->assertFalse($user->fresh()->hasActiveSubscription());
        Http::assertNothingSent();
    }

    public function test_auto_poll_leaves_a_payment_the_buyer_may_still_finish(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();
        $payment = $this->pending($user, 'ORDER-OPEN', 30, ['plan_id' => $plan->id]);

        // orderStatus 0 — заказ зарегистрирован, карта не введена.
        $this->bankSays(['ORDER-OPEN' => ['orderStatus' => 0]]);

        $this->runAutoPoll();

        $this->assertSame('pending', $payment->fresh()->status);
    }

    public function test_auto_poll_ignores_payments_of_other_providers(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();

        $stub = $this->pending($user, 'stub-1', 30, ['plan_id' => $plan->id]);
        $stub->forceFill(['provider' => 'stub'])->save();

        $this->bankSays([]);

        $this->runAutoPoll();

        // Ни строки не тронуто и банк не спрошен: у тестового контура заказа
        // в банке нет, спрашивать про него — гарантированный «не найден».
        $this->assertSame('pending', $stub->fresh()->status);
        Http::assertNothingSent();
    }

    public function test_late_payment_extends_a_running_subscription_instead_of_replacing_it(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();

        // Действующая подписка: двадцать оплаченных дней впереди.
        $running = UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now()->subDays(10),
            'ends_at' => now()->addDays(20),
            'auto_renew' => true,
        ]);

        app(PaymentFulfillmentService::class)->activateSubscription($user, $plan->id);

        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->get();

        $this->assertCount(1, $active, 'действующая подписка должна остаться одна');
        $this->assertSame(
            $running->ends_at->addDays(30)->toDateString(),
            $active->first()->ends_at->toDateString(),
            'новый срок отсчитывается от конца прежнего, а не от сегодня',
        );
        $this->assertSame('cancelled', $running->fresh()->status);
    }

    public function test_two_late_payments_deliver_two_periods(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();

        $service = app(PaymentFulfillmentService::class);
        $service->activateSubscription($user, $plan->id);
        $service->activateSubscription($user, $plan->id);

        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        // Две оплаты — два месяца. Раньше вторая отменяла первую, и деньги
        // за неё пропадали; ради этого правило и переписано.
        $this->assertSame(
            now()->addDays(60)->toDateString(),
            $active->ends_at->toDateString(),
        );
    }

    /**
     * Замена тарифа на всех трёх, а не на одном.
     *
     * Переход между тарифами — единственный случай, где перенос остатка
     * виден: у продления тем же тарифом разница между «от конца» и «от
     * сегодня» равна остатку, а у замены к ней добавляется ещё и разная
     * длительность периода. 508 потерял бы двадцать дней именно на замене.
     *
     * Проверяются все три боевых тарифа в обе стороны: с дешёвого на
     * дорогой и обратно. Ожидание считается арифметикой от даты окончания
     * прежней подписки, а не переписыванием того, что вернул код.
     */
    public function test_switching_between_all_three_plans_keeps_paid_days(): void
    {
        $plans = [
            'month' => $this->seedPlan('month', 30),
            'half-year' => $this->seedPlan('half-year', 182),
            'year' => $this->seedPlan('year', 365),
        ];

        $service = app(PaymentFulfillmentService::class);

        foreach ($plans as $fromSlug => $from) {
            foreach ($plans as $toSlug => $to) {
                $user = $this->seedUser();

                // Действующая подписка: половина периода уже прожита.
                $remaining = intdiv($from->period_days, 2);
                $running = UserSubscription::query()->create([
                    'user_id' => $user->id,
                    'plan_id' => $from->id,
                    'status' => 'active',
                    'starts_at' => now()->subDays($from->period_days - $remaining),
                    'ends_at' => now()->addDays($remaining),
                    'auto_renew' => true,
                ]);

                $service->activateSubscription($user, $to->id);

                $active = UserSubscription::query()
                    ->where('user_id', $user->id)
                    ->where('status', 'active')
                    ->get();

                $this->assertCount(
                    1,
                    $active,
                    "{$fromSlug} → {$toSlug}: действующая подписка должна остаться одна",
                );

                $this->assertSame(
                    $to->id,
                    (int) $active->first()->plan_id,
                    "{$fromSlug} → {$toSlug}: действует новый тариф",
                );

                $this->assertSame(
                    $running->ends_at->copy()->addDays($to->period_days)->toDateString(),
                    $active->first()->ends_at->toDateString(),
                    "{$fromSlug} → {$toSlug}: срок отсчитан от конца прежней подписки",
                );

                // И отдельно то, ради чего всё: оплаченные дни не сгорели.
                $this->assertGreaterThanOrEqual(
                    $remaining + $to->period_days - 1,
                    (int) now()->diffInDays($active->first()->ends_at),
                    "{$fromSlug} → {$toSlug}: остаток прежнего периода потерян",
                );
            }
        }
    }

    public function test_expired_subscription_does_not_carry_anything_over(): void
    {
        $user = $this->seedUser();
        $plan = $this->seedPlan();

        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now()->subDays(60),
            'ends_at' => now()->subDays(5),
            'auto_renew' => false,
        ]);

        app(PaymentFulfillmentService::class)->activateSubscription($user, $plan->id);

        $active = UserSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        // Просроченная подписка не даёт ничего: пять дней назад кончилась,
        // переносить нечего.
        $this->assertSame(now()->addDays(30)->toDateString(), $active->ends_at->toDateString());
    }
}
