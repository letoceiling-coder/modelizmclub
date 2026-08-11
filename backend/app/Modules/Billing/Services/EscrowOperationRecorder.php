<?php

namespace Modules\Billing\Services;

use App\Enums\EscrowOperationStatus;
use App\Enums\EscrowOperationType;
use App\Models\EscrowDeal;
use App\Models\EscrowOperation;
use App\Models\User;
use Illuminate\Support\Str;

class EscrowOperationRecorder
{
    /**
     * @param  array<string, mixed>  $request
     */
    public function start(
        EscrowDeal $deal,
        EscrowOperationType $type,
        string $initiatedBy,
        ?User $admin = null,
        ?int $amountCents = null,
        ?string $reason = null,
        array $request = [],
        ?string $idempotencyKey = null,
    ): EscrowOperation {
        return EscrowOperation::query()->create([
            'escrow_deal_id' => $deal->id,
            'type' => $type,
            'amount_cents' => $amountCents,
            'currency' => $deal->currency,
            'status' => EscrowOperationStatus::Pending,
            'provider' => $deal->payment_provider,
            'initiated_by' => $initiatedBy,
            'admin_user_id' => $admin?->id,
            'idempotency_key' => $idempotencyKey ?? (string) Str::uuid(),
            'request_payload' => $request,
            'reason' => $reason,
        ]);
    }

    public function succeed(EscrowOperation $operation, ?string $providerRef = null, ?array $response = null): EscrowOperation
    {
        $operation->update([
            'status' => EscrowOperationStatus::Success,
            'provider_reference' => $providerRef ?? $operation->provider_reference,
            'response_payload' => $response ?? $operation->response_payload,
            'error_message' => null,
        ]);

        return $operation->fresh();
    }

    public function fail(EscrowOperation $operation, string $message, ?array $response = null): EscrowOperation
    {
        $operation->update([
            'status' => EscrowOperationStatus::Failed,
            'error_message' => $message,
            'response_payload' => $response ?? $operation->response_payload,
        ]);

        return $operation->fresh();
    }
}
