<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Billing\Services\PaymentFulfillmentService;
use Modules\Billing\Services\PaymentGatewayManager;

/**
 * Resolves a stub (test acquiring) payment: paid / insufficient funds / declined card.
 * Allowed while the resolved gateway is stub (BILLING_PROVIDER=stub, or auto without VTB).
 * Live BILLING_PROVIDER=vtb cannot be confirmed here.
 */
class ConfirmStubPaymentController extends Controller
{
    public function __invoke(Request $request, string $uuid, PaymentFulfillmentService $fulfillment): JsonResponse
    {
        $mode = (string) config('billing.provider', 'auto');
        $resolved = app(PaymentGatewayManager::class)->provider();
        if ($mode === 'vtb' || $resolved !== 'stub') {
            return response()->json([
                'message' => 'Оплата подтверждается только через платёжный шлюз.',
                'code' => 'vtb_required',
            ], 403);
        }

        $data = $request->validate([
            'outcome' => ['sometimes', 'nullable', Rule::in(['paid', 'insufficient_funds', 'declined'])],
        ]);
        $outcome = $data['outcome'] ?? 'paid';

        $payment = Payment::query()
            ->where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->where('provider', 'stub')
            ->firstOrFail();

        if ($payment->status === 'paid') {
            return $this->resolved($payment, 'paid', $this->redirectUrl($payment, true));
        }

        if ($payment->status === 'failed' && $outcome !== 'paid') {
            return $this->resolved($payment, 'failed', $this->redirectUrl($payment, false, $outcome));
        }

        if ($outcome === 'paid') {
            $fulfillment->markPaid($payment);
            $payment->refresh();

            return $this->resolved($payment, 'paid', $this->redirectUrl($payment, true));
        }

        $reason = $outcome === 'insufficient_funds' ? 'insufficient_funds' : 'declined';
        $fulfillment->markFailed($payment, $reason);
        $payment->refresh();

        return $this->resolved($payment, 'failed', $this->redirectUrl($payment, false, $reason));
    }

    private function resolved(Payment $payment, string $status, string $redirectUrl): JsonResponse
    {
        return response()->json([
            'data' => [
                'payment_uuid' => $payment->uuid,
                'status' => $status,
                'redirect_url' => $redirectUrl,
            ],
        ]);
    }

    private function redirectUrl(Payment $payment, bool $success, ?string $reason = null): string
    {
        $meta = $payment->metadata ?? [];
        $frontend = rtrim((string) config('billing.frontend_url'), '/');
        $type = (string) ($meta['payable_type'] ?? 'subscription');

        $defaultReturn = match ($type) {
            'wallet_topup' => $frontend.'/settings/wallet?payment=success',
            'listing_placement', 'listing_boost' => $frontend.'/my-ads?payment=success',
            default => (string) config('billing.return_url'),
        };
        $defaultFail = match ($type) {
            'wallet_topup' => $frontend.'/settings/wallet?payment=failed',
            'listing_placement', 'listing_boost' => $frontend.'/my-ads?payment=failed',
            default => (string) config('billing.fail_url'),
        };

        $base = $success
            ? (string) ($meta['return_url'] ?? $defaultReturn)
            : (string) ($meta['fail_url'] ?? $defaultFail);

        return $this->appendQuery($base, [
            'uuid' => $payment->uuid,
            'reason' => $success ? null : $reason,
        ]);
    }

    /** @param  array<string, scalar|null>  $params */
    private function appendQuery(string $url, array $params): string
    {
        $filtered = [];
        foreach ($params as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $filtered[$key] = (string) $value;
        }
        if ($filtered === []) {
            return $url;
        }

        $sep = str_contains($url, '?') ? '&' : '?';

        return $url.$sep.http_build_query($filtered);
    }
}
