<?php

namespace Modules\Billing\Services;

use App\Enums\SafeDealGatewayContour;
use App\Enums\SafeDealIncomingStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealGatewayEvent;
use App\Models\SafeDealIncomingPayment;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbAcquiringClient;
use RuntimeException;
use Throwable;

/**
 * Money side of a safe deal, taken from the buyer's card by VTB.
 *
 * Two acquiring shapes map onto the same deal lifecycle. With a two-stage hold
 * the money stays on the buyer's card: `registerPreAuth` at checkout, `deposit`
 * on completion, `reverse` on cancellation. Where the bank has not granted
 * предавторизация, a one-stage `register.do` charges the card straight to the
 * merchant account and cancellation gives it back with `refund`. Every RBS
 * reply is journalled in `safe_deal_gateway_events`.
 */
class SafeDealSettlementService
{
    public const PROVIDER_VTB = 'vtb';

    public const PROVIDER_WALLET = 'wallet';

    public function __construct(private readonly VtbAcquiringClient $client) {}

    /** Which escrow backend this installation uses. */
    public function provider(): string
    {
        $mode = (string) config('billing.safe_deal.escrow_provider', 'auto');

        return match ($mode) {
            self::PROVIDER_WALLET => self::PROVIDER_WALLET,
            self::PROVIDER_VTB => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
            default => $this->vtbConfigured() ? self::PROVIDER_VTB : self::PROVIDER_WALLET,
        };
    }

    public function usesVtb(): bool
    {
        return $this->provider() === self::PROVIDER_VTB;
    }

    /** `two_stage` keeps the money on the card; `one_stage` charges it at once. */
    public function captureMode(): string
    {
        return (string) config('billing.safe_deal.vtb_capture_mode', SafeDealIncomingPayment::CAPTURE_TWO_STAGE)
            === SafeDealIncomingPayment::CAPTURE_ONE_STAGE
                ? SafeDealIncomingPayment::CAPTURE_ONE_STAGE
                : SafeDealIncomingPayment::CAPTURE_TWO_STAGE;
    }

    public function holdsOnCard(): bool
    {
        return $this->captureMode() === SafeDealIncomingPayment::CAPTURE_TWO_STAGE;
    }

    /**
     * Registers the charge and returns the row carrying the checkout URL. The
     * deal stays unpaid until VTB reports the card went through — orderStatus 1
     * (authorized) for a hold, 2 (deposited) for a one-stage charge.
     */
    public function openHold(SafeDeal $deal, User $buyer, string $description, ?string $returnUrl = null): SafeDealIncomingPayment
    {
        $twoStage = $this->holdsOnCard();

        $incoming = SafeDealIncomingPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'buyer_id' => $buyer->id,
            'amount_kopecks' => (int) $deal->amount_kopecks,
            'currency' => $deal->currency ?? 'RUB',
            'status' => SafeDealIncomingStatus::Pending,
            'capture_mode' => $this->captureMode(),
        ]);

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $target = $returnUrl ?: $base.'/deals/'.$deal->uuid;

        $params = [
            'orderNumber' => $incoming->uuid,
            'amount' => (int) $deal->amount_kopecks,
            'currency' => config('billing.vtb.currency_code'),
            'returnUrl' => $this->appendQuery($target, ['deal' => $deal->uuid, 'paid' => '1']),
            'failUrl' => $this->appendQuery($target, ['deal' => $deal->uuid, 'paid' => '0']),
            'description' => mb_substr($description, 0, 598),
            'language' => config('billing.vtb.language'),
            'clientId' => (string) $buyer->id,
            'dynamicCallbackUrl' => url('/api/v1/safe-deals/webhooks/vtb'),
        ];

        $endpoint = $twoStage ? 'registerPreAuth.do' : 'register.do';
        $register = $twoStage ? $this->client->registerPreAuth($params) : $this->client->registerOrder($params);

        $orderId = (string) ($register['orderId'] ?? '');
        $formUrl = $register['formUrl'] ?? null;

        if ($orderId === '' || ! $formUrl) {
            $incoming->update([
                'status' => SafeDealIncomingStatus::Failed,
                'fail_reason' => $endpoint.' did not return orderId/formUrl',
                'failed_at' => now(),
            ]);

            throw new RuntimeException('Не удалось зарегистрировать оплату в ВТБ.');
        }

        $incoming->update([
            'rbs_order_id' => $orderId,
            'rbs_order_number' => $incoming->uuid,
            'checkout_url' => $formUrl,
        ]);

        $this->journal($deal, $incoming, $twoStage ? 'preauth.registered' : 'payment.registered', $register);

        return $incoming->fresh();
    }

    /** Pulls the live RBS status and stores it. Returns the refreshed row. */
    public function syncHold(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if (! $incoming->rbs_order_id) {
            return $incoming;
        }

        $status = $this->client->getOrderStatusExtended($incoming->rbs_order_id);
        $incoming->applyRbsOrderStatus(VtbAcquiringClient::orderStatus($status));
        $incoming->save();

        $this->journal($incoming->safeDeal, $incoming, 'order.status', $status);

        return $incoming->fresh();
    }

    /**
     * Settles the money — call when the deal completes. A one-stage charge is
     * already on the merchant account, so there is nothing left to capture.
     */
    public function capture(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if ($incoming->status === SafeDealIncomingStatus::Captured || ! $incoming->isTwoStage()) {
            return $incoming;
        }

        if (! $incoming->rbs_order_id) {
            throw new RuntimeException('Оплата в ВТБ не зарегистрирована.');
        }

        $response = $this->client->deposit($incoming->rbs_order_id, (int) $incoming->amount_kopecks);
        $this->journal($incoming->safeDeal, $incoming, 'preauth.captured', $response);

        return $this->syncHold($incoming);
    }

    /**
     * Gives the money back: `reverse` while the hold is uncaptured, `refund`
     * once it has already settled.
     */
    public function releaseBack(SafeDealIncomingPayment $incoming): SafeDealIncomingPayment
    {
        if (! $incoming->rbs_order_id) {
            return $incoming;
        }

        if (in_array($incoming->status, [SafeDealIncomingStatus::Reversed, SafeDealIncomingStatus::Refunded], true)) {
            return $incoming;
        }

        if ($incoming->status === SafeDealIncomingStatus::Captured) {
            $response = $this->client->refund($incoming->rbs_order_id, (int) $incoming->amount_kopecks);
            $this->journal($incoming->safeDeal, $incoming, 'payment.refunded', $response);
        } else {
            $response = $this->client->reverse($incoming->rbs_order_id);
            $this->journal($incoming->safeDeal, $incoming, 'preauth.reversed', $response);
        }

        return $this->syncHold($incoming);
    }

    public function findByRbsOrderId(string $orderId): ?SafeDealIncomingPayment
    {
        return SafeDealIncomingPayment::query()
            ->with('safeDeal')
            ->where('rbs_order_id', $orderId)
            ->first();
    }

    private function vtbConfigured(): bool
    {
        if (! config('billing.vtb.enabled')) {
            return false;
        }

        return (bool) config('billing.vtb.token')
            || (config('billing.vtb.username') && config('billing.vtb.password'));
    }

    /** @param array<string, mixed> $payload */
    private function journal(?SafeDeal $deal, SafeDealIncomingPayment $incoming, string $eventType, array $payload): void
    {
        try {
            SafeDealGatewayEvent::query()->create([
                'uuid' => (string) Str::uuid(),
                'contour' => SafeDealGatewayContour::Ie,
                'event_type' => $eventType,
                'safe_deal_id' => $deal?->id ?? $incoming->safe_deal_id,
                'incoming_payment_id' => $incoming->id,
                'idempotency_key' => $eventType.':'.$incoming->id.':'.md5(json_encode($payload) ?: ''),
                'payload' => $payload,
                'processed_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('SafeDeal: gateway event not journalled', [
                'incoming' => $incoming->id,
                'event' => $eventType,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /** @param array<string, string> $params */
    private function appendQuery(string $url, array $params): string
    {
        return $url.(str_contains($url, '?') ? '&' : '?').http_build_query($params);
    }
}
