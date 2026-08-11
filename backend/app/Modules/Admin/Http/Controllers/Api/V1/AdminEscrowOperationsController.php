<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EscrowDeal;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Http\Resources\AdminEscrowDealResource;
use Modules\Billing\Services\AdminEscrowOperationService;

#[Group('Admin — Escrow', weight: 26)]
class AdminEscrowOperationsController extends Controller
{
    public function sync(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->sync($request->user(), $deal, $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function capture(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'amount_cents' => ['nullable', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->capture(
            $request->user(),
            $deal,
            $data['amount_cents'] ?? null,
            $data['reason'],
            $data['idempotency_key'] ?? null,
        );

        return $this->response($deal);
    }

    public function reverse(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->reverse($request->user(), $deal, $data['reason'], $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function refund(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'amount_cents' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->refund(
            $request->user(),
            $deal,
            (int) $data['amount_cents'],
            $data['reason'],
            $data['idempotency_key'] ?? null,
        );

        return $this->response($deal);
    }

    public function payout(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'amount_cents' => ['nullable', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->payout(
            $request->user(),
            $deal,
            $data['amount_cents'] ?? null,
            $data['reason'],
            $data['idempotency_key'] ?? null,
        );

        return $this->response($deal);
    }

    public function freeze(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->freeze($request->user(), $deal, $data['reason'], $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function unfreeze(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->unfreeze($request->user(), $deal, $data['reason'], $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function cancel(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->cancel($request->user(), $deal, $data['reason'], $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function resolveDispute(Request $request, string $uuid, AdminEscrowOperationService $ops): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'outcome' => ['required', 'string', 'in:buyer,seller,split'],
            'buyer_amount_cents' => ['nullable', 'integer', 'min:0'],
            'seller_amount_cents' => ['nullable', 'integer', 'min:0'],
            'note' => ['required', 'string', 'min:10', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $deal = $ops->resolveDispute($request->user(), $deal, $data, $data['idempotency_key'] ?? null);

        return $this->response($deal);
    }

    public function updateNote(Request $request, string $uuid): JsonResponse
    {
        $deal = $this->deal($uuid);
        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:5000'],
        ]);

        $deal->update(['admin_note' => $data['admin_note'] ?? null]);

        return $this->response($deal->fresh([
            'listing', 'buyer.profile', 'seller.profile', 'shipment.events', 'payment', 'operations',
        ]));
    }

    private function deal(string $uuid): EscrowDeal
    {
        return EscrowDeal::query()->where('uuid', $uuid)->firstOrFail();
    }

    private function response(EscrowDeal $deal): JsonResponse
    {
        return response()->json(['data' => new AdminEscrowDealResource($deal)]);
    }
}
