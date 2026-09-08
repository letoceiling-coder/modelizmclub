<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Support\PaymentAccountingType;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * История платежей пользователя: что он покупал и чем это кончилось.
 *
 * Отдельно от истории кошелька, а не вместе с ней. Причина не в удобстве
 * раскладки, а в том, что это разные списки:
 *
 *   — Кошелёк показывает движения внутреннего баланса. Оплата картой в нём
 *     появляется только если она дошла: пополнение на 300 ₽ — это одна
 *     проводка. Объединённый список показал бы её дважды, потому что у неё
 *     есть и платёж, и проводка.
 *   — Платёж, который не дошёл, в кошельке не отражается вовсе — а это
 *     ровно те строки, ради которых история и нужна. У пользователя 606
 *     двенадцать платежей и ни одной подписки; в кошельке у него видно одно
 *     пополнение на 100 ₽, и по этому экрану он никогда не понял бы, что
 *     заплатил 1 097 ₽ и не получил ничего.
 *
 * Поэтому два списка рядом, каждый отвечает на свой вопрос: «за что я платил
 * и прошло ли» и «откуда взялись и куда ушли деньги на балансе».
 */
#[Group('Billing', weight: 20)]
class MyPaymentsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));

        $paginator = Payment::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        /** @var list<Payment> $items */
        $items = $paginator->items();

        // Названия тарифов одним запросом: без этого на странице из двадцати
        // подписок было бы двадцать обращений к базе.
        $planIds = collect($items)
            ->map(fn (Payment $p) => is_array($p->metadata) ? ($p->metadata['plan_id'] ?? null) : null)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->all();

        $planNames = $planIds === []
            ? collect()
            : SubscriptionPlan::query()->whereIn('id', $planIds)->pluck('name', 'id');

        return response()->json([
            'data' => collect($items)->map(function (Payment $payment) use ($planNames): array {
                $metadata = is_array($payment->metadata) ? $payment->metadata : [];
                $type = PaymentAccountingType::resolve($metadata);
                $planId = isset($metadata['plan_id']) ? (int) $metadata['plan_id'] : null;

                return [
                    'uuid' => $payment->uuid,
                    'amount' => (int) $payment->amount_cents,
                    'amount_rub' => round(((int) $payment->amount_cents) / 100, 2),
                    'currency' => $payment->currency,
                    'status' => $payment->status,
                    'type' => $type,
                    // Подпись на русском — запасная: экран переводит `type`
                    // сам, но выгрузка и отладка не должны зависеть от фронта.
                    'type_label' => PaymentAccountingType::label($type),
                    // Название тарифа — единственное, что отличает один
                    // платёж за подписку от другого.
                    'plan_name' => $planId !== null ? ($planNames[$planId] ?? null) : null,
                    'date' => $payment->created_at?->toIso8601String(),
                    'paid_at' => $payment->paid_at?->toIso8601String(),
                ];
            })->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
