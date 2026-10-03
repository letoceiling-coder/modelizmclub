<?php

namespace Modules\Billing\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Платёжный контур не настроен, и подменять его подменным нельзя.
 *
 * Сам себя превращает в ответ, а не разбирается в каждом вызывающем. Точек
 * создания платежа четыре — `CreatePaymentController` (дважды),
 * `WalletTopupController`, `ListingBoostService`, — и забытый `catch` в любой
 * из них отдал бы пятисотку вместо внятного отказа. А пятисотку в платёжном
 * пути читают как «сломалось у них», и человек пробует снова.
 */
class PaymentContourUnavailableException extends RuntimeException
{
    public function __construct(
        string $message = 'Оплата временно недоступна: платёжный шлюз не настроен.',
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'payment_contour_unavailable',
        ], 503);
    }
}
