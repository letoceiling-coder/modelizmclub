<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Contracts\PaymentGateway;

class CreatePaymentController extends Controller
{
    public function __invoke(Request $request, PaymentGateway $gateway): JsonResponse
    {
        $data = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:subscription_plans,slug'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $plan = SubscriptionPlan::query()->where('slug', $data['plan_slug'])->where('is_active', true)->first();

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
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ],
        );

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
