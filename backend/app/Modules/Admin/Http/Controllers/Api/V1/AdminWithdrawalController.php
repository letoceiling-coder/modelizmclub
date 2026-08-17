<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\WalletTransactionType;
use App\Http\Controllers\Controller;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Billing\Services\WalletService;

class AdminWithdrawalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = WithdrawalRequest::query()->with('user')->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate(min(100, max(1, (int) $request->query('per_page', 25))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (WithdrawalRequest $w) => [
                'uuid' => $w->uuid,
                'user' => ['uuid' => $w->user?->uuid, 'name' => $w->user?->name],
                'amount_kopecks' => (int) $w->amount_kopecks,
                'method' => $w->method,
                'destination' => $w->destination,
                'status' => $w->status,
                'created_at' => $w->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function update(Request $request, string $uuid, WalletService $wallet): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['processing', 'paid', 'rejected'])],
            'admin_comment' => ['nullable', 'string', 'max:500'],
        ]);

        $withdrawal = WithdrawalRequest::query()->where('uuid', $uuid)->firstOrFail();

        if (in_array($withdrawal->status, ['paid', 'rejected'], true)) {
            return response()->json(['message' => 'Заявка уже обработана.'], 422);
        }

        DB::transaction(function () use ($withdrawal, $data, $wallet): void {
            if ($data['status'] === 'rejected') {
                // Return the held funds to the user's spendable balance.
                $wallet->credit(
                    $withdrawal->user,
                    (int) $withdrawal->amount_kopecks,
                    WalletTransactionType::WithdrawalRefund,
                    'Возврат по отклонённой заявке на вывод',
                    'withdrawal',
                    $withdrawal->id,
                    'withdrawal-refund:'.$withdrawal->id,
                );
            }

            $withdrawal->update([
                'status' => $data['status'],
                'admin_comment' => $data['admin_comment'] ?? $withdrawal->admin_comment,
                'processed_at' => in_array($data['status'], ['paid', 'rejected'], true) ? now() : null,
            ]);
        });

        return response()->json([
            'data' => ['uuid' => $withdrawal->uuid, 'status' => $withdrawal->fresh()->status],
            'message' => 'Статус заявки обновлён.',
        ]);
    }
}
