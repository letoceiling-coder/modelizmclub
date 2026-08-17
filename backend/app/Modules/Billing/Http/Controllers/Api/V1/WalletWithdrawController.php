<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Enums\WalletTransactionType;
use App\Http\Controllers\Controller;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Billing\Exceptions\InsufficientFundsException;
use Modules\Billing\Services\WalletService;

class WalletWithdrawController extends Controller
{
    public function __invoke(Request $request, WalletService $wallet): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:100', 'max:1000000'],
            'method' => ['required', Rule::in(['card', 'sbp', 'account'])],
            'destination' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $amountKopecks = (int) round(((float) $data['amount']) * 100);

        try {
            $withdrawal = DB::transaction(function () use ($wallet, $user, $amountKopecks, $data): WithdrawalRequest {
                $tx = $wallet->debit(
                    $user,
                    $amountKopecks,
                    WalletTransactionType::Withdrawal,
                    'Заявка на вывод средств',
                    'withdrawal',
                    null,
                );

                $request = WithdrawalRequest::query()->create([
                    'user_id' => $user->id,
                    'amount_kopecks' => $amountKopecks,
                    'method' => $data['method'],
                    'destination' => $data['destination'],
                    'status' => 'pending',
                    'wallet_transaction_id' => $tx->id,
                ]);

                $tx->update(['ref_id' => $request->id]);

                return $request;
            });
        } catch (InsufficientFundsException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'insufficient_funds',
            ], 422);
        }

        return response()->json([
            'data' => [
                'uuid' => $withdrawal->uuid,
                'amount_kopecks' => $withdrawal->amount_kopecks,
                'status' => $withdrawal->status,
            ],
            'message' => 'Заявка на вывод создана и ожидает обработки.',
        ], 201);
    }
}
