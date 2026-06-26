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
            'RUB',
            "Подписка «{$plan->name}»",
            [
                'plan_id' => $plan->id,
                'plan_slug' => $plan->slug,
                'idempotency_key' => $data['idempotency_key'] ?? null,
            ],
        );

        return response()->json([
            'data' => $result,
            'message' => 'Платёж создан. Подключение провайдера будет активировано позже.',
        ], 201);
    }
}
