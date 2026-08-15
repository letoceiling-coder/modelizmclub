<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\PaymentAccountingType;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('Admin — Billing', weight: 74)]
class AdminPaymentsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, $request->integer('per_page', 30)));
        $paginator = $this->query($request)->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Payment $p) => $this->serialize($p))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            'filters' => [
                'types' => PaymentAccountingType::labels(),
                'statuses' => ['pending', 'paid', 'failed', 'cancelled'],
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filename = 'payments-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, [
                'UUID',
                'Дата',
                'Email',
                'Сумма (₽)',
                'Валюта',
                'Статус',
                'Тип',
                'Провайдер',
                'ID провайдера',
                'Описание',
            ], ';');

            $this->query($request)
                ->orderByDesc('id')
                ->chunk(200, function ($payments) use ($handle): void {
                    foreach ($payments as $payment) {
                        $row = $this->serialize($payment);
                        fputcsv($handle, [
                            $row['uuid'],
                            $row['paid_at'] ?? $row['created_at'],
                            $row['user_email'] ?? '',
                            number_format($row['amount_rub'], 2, ',', ''),
                            $row['currency'],
                            $row['status'],
                            $row['type_label'],
                            $row['provider'] ?? '',
                            $row['provider_payment_id'] ?? '',
                            $row['description'],
                        ], ';');
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function query(Request $request): Builder
    {
        $query = Payment::query()
            ->with(['user:id,uuid,email,name'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($from = $request->date('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->date('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($type = $request->string('type')->toString()) {
            $query->where(function (Builder $q) use ($type): void {
                match ($type) {
                    PaymentAccountingType::SUBSCRIPTION => $q->where('metadata->payable_type', 'subscription')
                        ->orWhereNotNull('metadata->plan_id'),
                    PaymentAccountingType::LISTING => $q->where('metadata->payable_type', 'listing_placement'),
                    PaymentAccountingType::LISTING_BOOST => $q->where('metadata->payable_type', 'listing_boost'),
                    PaymentAccountingType::ESCROW => $q->where('metadata->payable_type', 'escrow'),
                    default => $q->where(function (Builder $inner): void {
                        $inner->whereNull('metadata->payable_type')
                            ->whereNull('metadata->plan_id');
                    }),
                };
            });
        }

        return $query;
    }

    /** @return array<string, mixed> */
    private function serialize(Payment $payment): array
    {
        $metadata = is_array($payment->metadata) ? $payment->metadata : [];
        $type = PaymentAccountingType::resolve($metadata);

        return [
            'id' => $payment->id,
            'uuid' => $payment->uuid,
            'user_uuid' => $payment->user?->uuid,
            'user_email' => $payment->user?->displayEmail() ?? $payment->user?->email,
            'amount_cents' => $payment->amount_cents,
            'amount_rub' => round($payment->amount_cents / 100, 2),
            'currency' => $payment->currency,
            'status' => $payment->status,
            'type' => $type,
            'type_label' => PaymentAccountingType::label($type),
            'provider' => $payment->provider,
            'provider_payment_id' => $payment->provider_payment_id,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'created_at' => $payment->created_at?->toIso8601String(),
            'description' => $this->description($metadata, $type),
        ];
    }

    /** @param  array<string, mixed>  $metadata */
    private function description(array $metadata, string $type): string
    {
        return match ($type) {
            PaymentAccountingType::SUBSCRIPTION => 'Подписка'.(isset($metadata['plan_slug']) ? ' ('.$metadata['plan_slug'].')' : ''),
            PaymentAccountingType::LISTING => 'Размещение объявления',
            PaymentAccountingType::LISTING_BOOST => 'Поднятие объявления',
            PaymentAccountingType::ESCROW => 'Escrow deal #'.($metadata['deal_id'] ?? '—'),
            default => 'Платёж',
        };
    }
}
