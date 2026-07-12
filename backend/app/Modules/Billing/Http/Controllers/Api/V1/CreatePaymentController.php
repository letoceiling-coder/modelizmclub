<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Contracts\PaymentGateway;

class CreatePaymentController extends Controller
{
    private const LISTING_PLACEMENT_CENTS = 9900;

    public function __invoke(Request $request, PaymentGateway $gateway): JsonResponse
    {
        $data = $request->validate([
            'plan_slug' => ['required_without:payable_type', 'nullable', 'string', 'exists:subscription_plans,slug'],
            'payable_type' => ['sometimes', 'nullable', 'string', Rule::in(['listing_placement'])],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $payableType = $data['payable_type'] ?? null;

        if ($payableType === 'listing_placement') {
            $result = $gateway->createCheckout(
                $request->user(),
                self::LISTING_PLACEMENT_CENTS,
                config('billing.currency', 'RUB'),
                'Разовое размещение объявления',
                [
                    'payable_type' => 'listing_placement',
                    'idempotency_key' => $data['idempotency_key'] ?? null,
                ],
            );

            return $this->checkoutResponse($result);
        }

        $plan = SubscriptionPlan::query()
            ->where('slug', $data['plan_slug'] ?? '')
            ->where('is_active', true)
            ->first();

        if (! $plan) {
            throw ValidationException::withMessages([
                'plan_slug' => ['Тариф недоступен.'],
            ]);
        }

        $result = $gateway->createCheckout(
            $request->user(),
            $plan->price_cents,
            config('billing.currency', 'RUB'),
            "Подписка «{$plan->name}»",
            [
                'plan_id' => $plan->id,
                'plan_slug' => $plan->slug,
                'payable_type' => 'subscription',
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ],
        );

        return $this->checkoutResponse($result);
    }

    /** @param  array<string, mixed>  $result */
    private function checkoutResponse(array $result): JsonResponse
    {
        $providerLabel = match ($result['provider']) {
            'vtb' => 'ВТБ Эквайринг',
            'yookassa' => 'ЮKassa',
            default => 'тестовый режим',
        };

        return response()->json([
            'data' => $result,
            'message' => $result['checkout_url']
                ? "Платёж создан. Перенаправление на оплату ({$providerLabel})."
                : 'Платёж создан. Подтвердите оплату в тестовом режиме.',
        ], 201);
    }
}
