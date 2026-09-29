<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Contracts\PaymentGateway;
use App\Support\BonusPointsPrices;
use Modules\Billing\Exceptions\InsufficientFundsException;
use Modules\Billing\Exceptions\InsufficientPointsException;
use Modules\Billing\Services\BonusPointsPaymentService;
use Modules\Billing\Services\BonusPointsService;
use Modules\Billing\Services\WalletPaymentService;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Modules\Listing\Services\ListingPlacementPricingService;

class CreatePaymentController extends Controller
{
    public function __invoke(Request $request, PaymentGateway $gateway, ListingPlacementPricingService $pricing, WalletPaymentService $walletPayment): JsonResponse
    {
        $data = $request->validate([
            'plan_slug' => ['required_without:payable_type', 'nullable', 'string', 'exists:subscription_plans,slug'],
            'payable_type' => ['sometimes', 'nullable', 'string', Rule::in(['listing_placement'])],
            'taxonomy_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'subcategory_id' => ['nullable', 'integer'],
            'promocode' => ['nullable', 'string', 'max:64'],
            'listing_uuid' => ['nullable', 'uuid'],
            'pay_with' => ['sometimes', 'nullable', Rule::in(['gateway', 'wallet', 'points'])],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $payWith = $data['pay_with'] ?? 'gateway';
        $payWithWallet = $payWith === 'wallet';
        $payableType = $data['payable_type'] ?? null;

        if ($payableType === 'listing_placement') {
            $categoryId = $data['category_id'] ?? null;
            $subcategoryId = $data['subcategory_id'] ?? null;
            if (! empty($data['taxonomy_id']) || $categoryId) {
                $pair = app(CategoryTaxonomyService::class)->resolveListingCategoryInput(
                    $categoryId ? (int) $categoryId : null,
                    $subcategoryId ? (int) $subcategoryId : null,
                    ! empty($data['taxonomy_id']) ? (int) $data['taxonomy_id'] : null,
                );
                $categoryId = $pair['category_id'];
                $subcategoryId = $pair['subcategory_id'];
            }

            $quote = $pricing->quote(
                $request->user(),
                $categoryId,
                $subcategoryId,
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
            $frontend = rtrim((string) config('billing.frontend_url'), '/');
            $metadata = [
                'payable_type' => 'listing_placement',
                'category_id' => $categoryId,
                'subcategory_id' => $subcategoryId,
                'promocode_id' => $quote['promocode']['id'] ?? null,
                'listing_uuid' => $data['listing_uuid'] ?? null,
                'quote' => $quote,
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'return_url' => $frontend.'/my-ads?payment=success',
                'fail_url' => $frontend.'/my-ads?payment=failed',
            ];

            /*
             * Баллы — до кошелька, потому что это не деньги: они не
             * уменьшают рублёвый баланс и не попадают в выручку.
             * Рублёвая цена размещения при этом остаётся в metadata:
             * она нужна, чтобы знать, что именно человек не заплатил.
             */
            if ($payWith === 'points') {
                return $this->payWithPoints(
                    (int) BonusPointsPrices::forPlacement(),
                    $request,
                    'listing_placement_points',
                    "Размещение объявления: {$categoryName}",
                    $metadata,
                );
            }

            if ($payWithWallet) {
                return $this->payFromWallet(
                    $walletPayment,
                    $request,
                    (int) $quote['final_cents'],
                    \App\Enums\WalletTransactionType::ListingPlacement,
                    "Размещение объявления: {$categoryName}",
                    $metadata,
                );
            }

            $result = $gateway->createCheckout(
                $request->user(),
                (int) $quote['final_cents'],
                config('billing.currency', 'RUB'),
                "Размещение объявления: {$categoryName}",
                $metadata,
            );

            return $this->checkoutResponse($result);
        }

        if ($payWith === 'points') {
            // Не «пока нельзя», а решение: подписка месячная, её выгоднее
            // продавать за деньги. Молча уводить такой запрос в шлюз
            // нельзя — человек нажал «баллами» и получил бы счёт.
            throw ValidationException::withMessages([
                'pay_with' => ['Подписка баллами не оплачивается.'],
            ]);
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

        if ((int) $plan->price_cents <= 0) {
            throw ValidationException::withMessages([
                'plan_slug' => ['Этот тариф бесплатный и не требует оплаты.'],
            ]);
        }

        $metadata = [
            'plan_id' => $plan->id,
            'plan_slug' => $plan->slug,
            'payable_type' => 'subscription',
            'idempotency_key' => $data['idempotency_key'] ?? null,
        ];

        if ($payWithWallet) {
            return $this->payFromWallet(
                $walletPayment,
                $request,
                (int) $plan->price_cents,
                \App\Enums\WalletTransactionType::Subscription,
                "Подписка «{$plan->name}»",
                $metadata,
            );
        }

        $result = $gateway->createCheckout(
            $request->user(),
            $plan->price_cents,
            config('billing.currency', 'RUB'),
            "Подписка «{$plan->name}»",
            $metadata,
        );

        return $this->checkoutResponse($result);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    /**
     * Оплата баллами. Не хватает — отказ с числом, а не «недостаточно».
     *
     * @param  array<string, mixed>  $metadata
     */
    private function payWithPoints(
        int $points,
        Request $request,
        string $type,
        string $description,
        array $metadata,
    ): JsonResponse {
        if ($points <= 0) {
            throw ValidationException::withMessages([
                'pay_with' => ['Оплата баллами сейчас недоступна.'],
            ]);
        }

        try {
            $payment = app(BonusPointsPaymentService::class)->pay(
                $request->user(),
                $points,
                $type,
                $description,
                array_merge($metadata, ['paid_with' => 'points']),
            );
        } catch (InsufficientPointsException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'insufficient_points',
                'points_required' => $points,
                'points_balance' => $e->balance,
                'points_short_by' => $e->shortBy,
                'errors' => ['pay_with' => [$e->getMessage()]],
            ], 422);
        }

        return response()->json([
            'data' => [
                'payment_uuid' => $payment->uuid,
                'checkout_url' => null,
                'status' => 'paid',
                'provider' => 'points',
                'points_spent' => $points,
                'points_balance' => app(BonusPointsService::class)->balance($request->user()->fresh()),
            ],
            'message' => 'Оплачено баллами.',
        ], 201);
    }

    private function payFromWallet(
        WalletPaymentService $walletPayment,
        Request $request,
        int $amountKopecks,
        \App\Enums\WalletTransactionType $type,
        string $description,
        array $metadata,
    ): JsonResponse {
        try {
            $payment = $walletPayment->pay($request->user(), $amountKopecks, $type, $description, $metadata);
        } catch (InsufficientFundsException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'insufficient_funds',
                'errors' => [
                    'pay_with' => [$e->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => [
                'payment_uuid' => $payment->uuid,
                'checkout_url' => null,
                'status' => 'paid',
                'provider' => 'wallet',
            ],
            'message' => 'Оплачено с баланса.',
        ], 201);
    }

    /** @param  array<string, mixed>  $result */
    private function checkoutResponse(array $result): JsonResponse
    {
        $providerLabel = match ($result['provider']) {
            'vtb' => 'ВТБ Эквайринг',
            'wallet' => 'баланс',
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
