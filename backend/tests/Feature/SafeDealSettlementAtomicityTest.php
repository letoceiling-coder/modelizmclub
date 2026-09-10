<?php

namespace Tests\Feature;

use App\Enums\SafeDealIncomingStatus;
use App\Enums\SafeDealPayoutChannel;
use App\Enums\SafeDealPayoutStatus;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealIncomingPayment;
use App\Models\SafeDealPayout;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Billing\Services\SafeDealHoldSyncService;
use Modules\Billing\Services\SafeDealPayoutService;
use Modules\Billing\Services\SafeDealSettlementService;
use RuntimeException;
use Tests\TestCase;

/**
 * Что остаётся в базе, если процесс умер посреди денежной развязки.
 *
 * Развязка устроена одинаково в обоих контурах: обращение к банку, потом
 * несколько записей. До 11.09 записи шли порознь, и падение между ними
 * оставляло половину.
 *
 * Худшая половина — у входящего платежа. Строка холда создаётся до
 * обращения в банк (иначе банку нечем назвать заказ), а `rbs_order_id`
 * пишется после ответа. Процесс, умерший в этом окне, оставлял заказ в
 * банке — возможно, с замороженными деньгами покупателя — и строку без
 * номера. Такую строку не берёт ни опрос холдов (у него
 * `whereNotNull('rbs_order_id')`), ни захват, ни возврат: оба начинаются с
 * той же проверки. Деньги зависали, и ни одна регулярная задача об этом не
 * узнавала.
 */
class SafeDealSettlementAtomicityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.safe_deal.escrow_provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.username' => 'merchant',
            'billing.vtb.password' => 'secret',
            'billing.vtb.token' => null,
            'billing.vtb.reconcile.delay_ms' => 0,

            'billing.vtb_payout.enabled' => true,
            'billing.vtb_payout.oauth_url' => 'https://vtb-payout.test/oauth2/token',
            'billing.vtb_payout.api_url' => 'https://vtb-payout.test/openapi',
            'billing.vtb_payout.client_id' => 'client',
            'billing.vtb_payout.client_secret' => 'secret',
        ]);
    }

    private function deal(): SafeDeal
    {
        $buyer = User::factory()->create();
        $seller = User::factory()->create();

        return SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => SafeDealStatus::Created,
            'amount_kopecks' => 150000,
            'platform_fee_kopecks' => 0,
            'seller_payout_kopecks' => 150000,
            'currency' => 'RUB',
        ]);
    }

    /** Строка холда ровно в том виде, в каком её оставляет падение. */
    private function incomingWithoutOrderId(SafeDeal $deal, int $minutesAgo = 30): SafeDealIncomingPayment
    {
        $incoming = SafeDealIncomingPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'buyer_id' => $deal->buyer_id,
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'currency' => 'RUB',
            'status' => SafeDealIncomingStatus::Pending,
            'capture_mode' => SafeDealIncomingPayment::CAPTURE_TWO_STAGE,
        ]);

        // created_at правим запросом: модель проставила «сейчас».
        DB::table('safe_deal_incoming_payments')
            ->where("id", $incoming->id)
            ->update(['created_at' => now()->subMinutes($minutesAgo)]);

        return $incoming->fresh();
    }

    private function processingPayout(SafeDeal $deal): SafeDealPayout
    {
        return SafeDealPayout::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'seller_id' => $deal->seller_id,
            'channel' => SafeDealPayoutChannel::Sbp,
            'status' => SafeDealPayoutStatus::Processing,
            'amount_kopecks' => 150000,
            'commission_kopecks' => 0,
            'currency' => 'RUB',
            'request_id' => (string) Str::uuid(),
            'payment_purpose' => 'Выплата',
            'sbp_phone' => '+79990000000',
            'sbp_bank_id' => '100000000004',
            'sbp_full_name' => 'Иванов Иван',
        ]);
    }

    public function test_lost_order_id_is_recovered_from_the_bank_by_order_number(): void
    {
        $deal = $this->deal();
        $incoming = $this->incomingWithoutOrderId($deal);
        $askedNumbers = [];

        Http::fake(function (Request $request) use (&$askedNumbers) {
            $askedNumbers[] = $request->data()['orderNumber'] ?? null;

            return Http::response(['orderStatus' => 1, 'attributes' => ['orderId' => 'RBS-LOST-1']]);
        });

        $result = app(SafeDealHoldSyncService::class)->recoverLostOrderIds();

        $this->assertSame(['checked' => 1, 'recovered' => 1, 'failed' => 0], $result);
        $this->assertSame([(string) $incoming->uuid], $askedNumbers);

        $fresh = $incoming->fresh();
        $this->assertSame('RBS-LOST-1', $fresh->rbs_order_id);
        $this->assertSame(SafeDealIncomingStatus::Authorized, $fresh->status);

        $this->assertDatabaseHas('safe_deal_gateway_events', [
            'incoming_payment_id' => $incoming->id,
            'event_type' => 'order.recovered',
        ]);
    }

    public function test_fresh_checkout_is_left_alone(): void
    {
        $deal = $this->deal();
        // Пять минут — покупатель ещё может вводить карту.
        $this->incomingWithoutOrderId($deal, 5);

        Http::fake(fn () => Http::response(['orderStatus' => 1, 'orderId' => 'RBS-X']));

        $this->assertSame(
            ['checked' => 0, 'recovered' => 0, 'failed' => 0],
            app(SafeDealHoldSyncService::class)->recoverLostOrderIds(),
        );
    }

    public function test_bank_that_does_not_know_the_order_leaves_the_row_as_is(): void
    {
        $deal = $this->deal();
        $incoming = $this->incomingWithoutOrderId($deal);

        // Заказ мог и не зарегистрироваться — процесс мог умереть раньше ответа.
        // Банк отвечает ошибкой, клиент превращает её в исключение, и для
        // восстановления это «не удалось», а не «нечего восстанавливать»:
        // отличить незарегистрированный заказ от сбоя связи здесь нечем, и
        // трогать строку в обоих случаях одинаково нельзя. Такую строку
        // закроет сторож брошенных чекаутов по сроку жизни сделки.
        Http::fake(fn () => Http::response(['errorCode' => '6', 'errorMessage' => 'Незарегистрированный заказ']));

        $result = app(SafeDealHoldSyncService::class)->recoverLostOrderIds();

        $this->assertSame(['checked' => 1, 'recovered' => 0, 'failed' => 1], $result);
        $this->assertNull($incoming->fresh()->rbs_order_id);
        $this->assertSame(0, DB::table('safe_deal_gateway_events')->count());
    }

    public function test_repeated_identical_bank_reply_does_not_duplicate_the_journal(): void
    {
        $deal = $this->deal();
        $incoming = $this->incomingWithoutOrderId($deal);
        $incoming->update(['rbs_order_id' => 'RBS-1']);

        Http::fake(fn () => Http::response(['orderStatus' => 1]));

        $settlement = app(SafeDealSettlementService::class);

        // Опрос холдов по расписанию получает один и тот же ответ, пока холд
        // держится. Раньше вторая запись падала в unique, а перехват гасил
        // ошибку; внутри транзакции она сломала бы и запись статуса.
        $settlement->syncHold($incoming);
        $settlement->syncHold($incoming->fresh());
        $settlement->syncHold($incoming->fresh());

        $this->assertSame(1, DB::table('safe_deal_gateway_events')
            ->where('event_type', 'order.status')
            ->count());

        $this->assertSame(SafeDealIncomingStatus::Authorized, $incoming->fresh()->status);
    }

    public function test_repeated_payout_poll_still_applies_the_status(): void
    {
        $deal = $this->deal();
        $payout = $this->processingPayout($deal);

        Http::fake(function (Request $request) {
            return str_contains($request->url(), 'oauth2/token')
                ? Http::response(['access_token' => 'token', 'expires_in' => 3600])
                : Http::response(['status' => 'PROCESSING']);
        });

        $payouts = app(SafeDealPayoutService::class);

        /*
         * Опрос выплаты по расписанию получает один и тот же ответ, пока банк
         * думает. Пока журнал вёлся обычной вставкой вне транзакции, повтор
         * падал в unique, а перехват это скрывал. Теперь запись идёт внутри
         * транзакции, и такой отказ утащил бы за собой статус: в PostgreSQL
         * неудавшийся оператор ломает всю транзакцию.
         *
         * Проверка держит обе половины сразу: одна строка в журнале и
         * применённый статус. Вернуть сюда `create()` — и второе отвалится.
         */
        $payouts->advance($payout);
        $payouts->advance($payout->fresh());
        $payouts->advance($payout->fresh());

        $this->assertSame(1, DB::table('safe_deal_gateway_events')
            ->where('event_type', 'payout.status')
            ->count());

        $this->assertSame(SafeDealPayoutStatus::Processing, $payout->fresh()->status);
    }

    public function test_payout_write_that_fails_midway_leaves_no_journal_entry(): void
    {
        $deal = $this->deal();

        $payout = $this->processingPayout($deal);

        /*
         * Подделка отвечает и на выдачу токена, и на опрос выплаты.
         *
         * Первая версия этого теста отвечала на всё одним `APPROVED` — и
         * проходила на коде до правки тоже. Причина: без `access_token`
         * клиент падал ещё до первой записи, `advance()` глушил исключение,
         * и «ноль записей в журнале» получался не из-за транзакции, а
         * из-за того, что до журнала дело не доходило. Тест, который зелен
         * при отсутствии починки, не проверяет починку.
         */
        Http::fake(function (Request $request) {
            return str_contains($request->url(), 'oauth2/token')
                ? Http::response(['access_token' => 'token', 'expires_in' => 3600])
                : Http::response(['status' => 'APPROVED']);
        });

        /*
         * Искусственный сбой ровно между двумя записями: журнал уже вставлен,
         * статус ещё нет. Без транзакции в базе осталась бы запись о событии,
         * которого не случилось.
         */
        SafeDealPayout::saving(function (): void {
            throw new RuntimeException('падение посередине');
        });

        app(SafeDealPayoutService::class)->advance($payout);

        $this->assertSame(0, DB::table('safe_deal_gateway_events')->count());
        $this->assertSame(SafeDealPayoutStatus::Processing, $payout->fresh()->status);
    }
}
