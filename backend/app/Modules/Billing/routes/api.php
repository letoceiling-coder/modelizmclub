<?php

use Illuminate\Support\Facades\Route;
use Modules\Billing\Http\Controllers\Api\V1\CancelSubscriptionController;
use Modules\Billing\Http\Controllers\Api\V1\ConfirmStubPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\CreatePaymentController;
use Modules\Billing\Http\Controllers\Api\V1\CreateSafeDealController;
use Modules\Billing\Http\Controllers\Api\V1\QuoteSafeDealController;
use Modules\Billing\Http\Controllers\Api\V1\ReviewSafeDealController;
use Modules\Billing\Http\Controllers\Api\V1\IndexPlansController;
use Modules\Billing\Http\Controllers\Api\V1\IndexSafeDealsController;
use Modules\Billing\Http\Controllers\Api\V1\MySubscriptionController;
use Modules\Billing\Http\Controllers\Api\V1\SafeDealActionsController;
use Modules\Billing\Http\Controllers\Api\V1\SafeDealDeliveryWebhookController;
use Modules\Billing\Http\Controllers\Api\V1\SafeDealPayoutWebhookController;
use Modules\Billing\Http\Controllers\Api\V1\SafeDealVtbWebhookController;
use Modules\Billing\Http\Controllers\Api\V1\ShowPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\ShowSafeDealController;
use Modules\Billing\Http\Controllers\Api\V1\SyncPaymentController;
use Modules\Billing\Http\Controllers\Api\V1\VtbWebhookController;
use Modules\Billing\Http\Controllers\Api\V1\WalletBalanceController;
use Modules\Billing\Http\Controllers\Api\V1\WalletTopupController;
use Modules\Billing\Http\Controllers\Api\V1\WalletTransactionsController;
use Modules\Billing\Http\Controllers\Api\V1\WalletWithdrawController;

Route::get('plans', IndexPlansController::class);

Route::match(['get', 'post'], 'payments/webhooks/vtb', VtbWebhookController::class);
Route::match(['get', 'post'], 'safe-deals/webhooks/vtb', SafeDealVtbWebhookController::class);
Route::post('safe-deals/webhooks/vtb-payout', SafeDealPayoutWebhookController::class);
Route::post('safe-deals/webhooks/delivery', SafeDealDeliveryWebhookController::class);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('users/me/subscription', MySubscriptionController::class);
    Route::post('users/me/subscription/cancel', CancelSubscriptionController::class);
    Route::post('payments', CreatePaymentController::class);
    Route::get('payments/{uuid}', ShowPaymentController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('payments/{uuid}/sync', SyncPaymentController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('payments/{uuid}/confirm-stub', ConfirmStubPaymentController::class)->where('uuid', '[0-9a-f-]{36}');

    Route::get('wallet', WalletBalanceController::class);
    Route::get('wallet/transactions', WalletTransactionsController::class);
    Route::post('wallet/topup', WalletTopupController::class);
    Route::post('wallet/withdraw', WalletWithdrawController::class);

    // Wallet-based safe deals (spec v4.0 §T5).
    Route::get('safe-deals', IndexSafeDealsController::class);
    Route::post('listings/{uuid}/safe-deal/quote', QuoteSafeDealController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('listings/{uuid}/safe-deal', CreateSafeDealController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::get('safe-deals/{uuid}', ShowSafeDealController::class)->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/ship', [SafeDealActionsController::class, 'ship'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/delivered', [SafeDealActionsController::class, 'delivered'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/confirm', [SafeDealActionsController::class, 'confirm'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/cancel', [SafeDealActionsController::class, 'cancel'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/dispute', [SafeDealActionsController::class, 'dispute'])->where('uuid', '[0-9a-f-]{36}');
    Route::post('safe-deals/{uuid}/review', ReviewSafeDealController::class)->where('uuid', '[0-9a-f-]{36}');
});
