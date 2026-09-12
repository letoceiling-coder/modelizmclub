<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Enums\WalletTransactionType;
use App\Http\Controllers\Controller;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Account\Services\PayoutRequisitesService;
use Modules\Billing\Exceptions\InsufficientFundsException;
use Modules\Billing\Services\WalletService;

class WalletWithdrawController extends Controller
{
    public function __invoke(
        Request $request,
        WalletService $wallet,
        PayoutRequisitesService $requisites,
    ): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:100', 'max:1000000'],
            'method' => ['required', Rule::in(['card', 'sbp', 'account'])],
            /*
             * Получателя можно не диктовать, если у пользователя уже сохранена
             * карта для выплат: полный номер лежит на сервере
             * (`user_payout_requisites.payout_card_number`), наружу отдаются
             * только последние четыре. До 12.09 подставить её было нечем — в
             * окне вывода номер набирали заново, хотя он уже сохранён.
             */
            'use_saved_card' => ['sometimes', 'boolean'],
            'destination' => ['required_without:use_saved_card', 'nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $amountKopecks = (int) round(((float) $data['amount']) * 100);

        if ($data['use_saved_card'] ?? false) {
            if ($data['method'] !== 'card') {
                return response()->json([
                    'message' => 'Сохранённая карта подходит только для вывода на карту.',
                    'code' => 'saved_card_wrong_method',
                ], 422);
            }

            $saved = $requisites->cardNumber($user);

            if ($saved === null) {
                return response()->json([
                    'message' => 'Сохранённой карты нет. Укажите номер или сохраните карту в реквизитах.',
                    'code' => 'saved_card_missing',
                ], 422);
            }

            $data['destination'] = $saved;
        }

        if (! filled($data['destination'] ?? null)) {
            return response()->json([
                'message' => 'Укажите получателя.',
                'code' => 'destination_required',
            ], 422);
        }

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
