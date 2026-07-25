<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Contracts\PaymentGateway;
use Modules\Listing\Services\ListingPlacementPricingService;

class CreatePaymentController extends Controller
{
    public function __invoke(Request $request, PaymentGateway $gateway, ListingPlacementPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'plan_slug' => ['required_without:payable_type', 'nullable', 'string', 'exists:subscription_plans,slug'],
            'payable_type' => ['sometimes', 'nullable', 'string', Rule::in(['listing_placement'])],
            'category_id' => ['nullable', 'integer', 'exists:listing_categories,id'],
            'subcategory_id' => ['nullable', 'integer', 'exists:listing_categories,id'],
            'promocode' => ['nullable', 'string', 'max:64'],
            'listing_uuid' => ['nullable', 'uuid'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $payableType = $data['payable_type'] ?? null;

        if ($payableType === 'listing_placement') {
            $quote = $pricing->quote(
                $request->user(),
                $data['category_id'] ?? null,
                $data['subcategory_id'] ?? null,
                $data['promocode'] ?? null,
            );

            if (($quote['promocode']['error'] ?? null) !== null) {
                throw ValidationException::withMessages([
                    'promocode' => [$quote['promocode']['error']],
                ]);
            }

            if ($quote['final_cents'] <= 0) {
                throw ValidationException::withMessages([
                    'payable_type' => ['Размещение бесплатное — оплата не требуется.'],
                ]);
            }

            $categoryName = $quote['category_name'] ?? 'объявление';
            $result = $gateway->createCheckout(
                $request->user(),
                (int) $quote['final_cents'],
                config('billing.currency', 'RUB'),
                "Размещение объявления: {$categoryName}",
                [
                    'payable_type' => 'listing_placement',
                    'category_id' => $data['category_id'] ?? null,
                    'subcategory_id' => $data['subcategory_id'] ?? null,
                    'promocode_id' => $quote['promocode']['id'] ?? null,
                    'listing_uuid' => $data['listing_uuid'] ?? null,
                    'quote' => $quote,
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
