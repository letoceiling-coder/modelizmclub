<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SafeDeal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminSafeDealController extends Controller
{
    public function __construct(private readonly SafeDealService $deals) {}

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->query($request)->paginate(min(100, max(1, (int) $request->query('per_page', 25))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SafeDeal $deal) => $this->row($deal))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /** Deal registry export — same filters as the table the admin is looking at. */
    public function export(Request $request): StreamedResponse
    {
        $filename = 'safe-deals-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, [
                'UUID',
                'Создана',
                'Статус',
                'Объявление',
                'Покупатель',
                'Email покупателя',
                'Продавец',
                'Email продавца',
                'Сумма (₽)',
                'Комиссия (₽)',
                'К выплате (₽)',
                'Доставка (₽)',
                'Способ доставки',
                'Трек-номер',
                'Оплачена',
                'Отправлена',
                'Доставлена',
                'Завершена',
                'Отменена',
            ], ';');

            $this->query($request)->chunk(200, function ($deals) use ($handle): void {
                foreach ($deals as $deal) {
                    fputcsv($handle, [
                        $deal->uuid,
                        $deal->created_at?->toDateTimeString(),
                        $deal->status->value,
                        $deal->listing?->title,
                        $deal->buyer?->name,
                        $deal->buyer?->email,
                        $deal->seller?->name,
                        $deal->seller?->email,
                        $this->rub($deal->amount_kopecks),
                        $this->rub($deal->platform_fee_kopecks),
                        $this->rub($deal->seller_payout_kopecks),
                        $this->rub($deal->delivery_cost_kopecks),
                        $deal->delivery_method,
                        $deal->tracking_number,
                        $deal->paid_at?->toDateTimeString(),
                        $deal->shipped_at?->toDateTimeString(),
                        $deal->delivered_at?->toDateTimeString(),
                        $deal->completed_at?->toDateTimeString(),
                        $deal->cancelled_at?->toDateTimeString(),
                    ], ';');
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function release(Request $request, string $uuid): JsonResponse
    {
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal = $this->deals->confirm($request->user(), $deal);

        return response()->json(['data' => $this->deals->toArray($deal), 'message' => 'Средства переведены продавцу.']);
    }

    public function refund(Request $request, string $uuid): JsonResponse
    {
        $deal = SafeDeal::query()->where('uuid', $uuid)->firstOrFail();
        $deal = $this->deals->cancel($request->user(), $deal);

        return response()->json(['data' => $this->deals->toArray($deal), 'message' => 'Средства возвращены покупателю.']);
    }

    private function query(Request $request): Builder
    {
        $query = SafeDeal::query()
            ->with(['listing', 'buyer', 'seller'])
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

        if ($search = trim($request->string('search')->toString())) {
            $query->where(function (Builder $q) use ($search): void {
                $q->where('uuid', 'like', "%{$search}%")
                    ->orWhere('tracking_number', 'like', "%{$search}%")
                    ->orWhereHas('buyer', fn (Builder $u) => $u->where('email', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%"))
                    ->orWhereHas('seller', fn (Builder $u) => $u->where('email', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%"));
            });
        }

        return $query;
    }

    /** @return array<string, mixed> */
    private function row(SafeDeal $deal): array
    {
        $row = $this->deals->toArray($deal);
        $row['buyer'] = ['uuid' => $deal->buyer?->uuid, 'name' => $deal->buyer?->name, 'email' => $deal->buyer?->email];
        $row['seller'] = ['uuid' => $deal->seller?->uuid, 'name' => $deal->seller?->name, 'email' => $deal->seller?->email];

        return $row;
    }

    private function rub(?int $kopecks): string
    {
        return number_format(((int) $kopecks) / 100, 2, ',', '');
    }
}
