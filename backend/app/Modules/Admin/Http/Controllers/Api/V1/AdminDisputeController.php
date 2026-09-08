<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\DisputeStatus;
use App\Http\Controllers\Controller;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;
use Modules\Billing\Services\SafeDealService;

class AdminDisputeController extends Controller
{
    public function __construct(private readonly SafeDealService $deals) {}

    public function index(Request $request): JsonResponse
    {
        $query = Dispute::query()->with(['safeDeal.listing', 'openedBy'])->latest();

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', DisputeStatus::Open->value);
        }

        $paginator = $query->paginate(min(100, max(1, (int) $request->query('per_page', 25))));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Dispute $d) => [
                'uuid' => $d->uuid,
                'status' => $d->status->value,
                'reason' => $d->reason,
                'description' => $d->description,
                'evidence' => $d->evidence ?? [],
                'opened_by' => ['uuid' => $d->openedBy?->uuid, 'name' => $d->openedBy?->name],
                'deal' => $this->deals->toArray($d->safeDeal),
                'created_at' => $d->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function resolve(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'in_favor_of' => ['required', Rule::in(['buyer', 'seller', 'split'])],
            'resolution' => ['nullable', 'string', 'max:2000'],
            'buyer_kopecks' => ['required_if:in_favor_of,split', 'integer', 'min:0'],
            'seller_kopecks' => ['required_if:in_favor_of,split', 'integer', 'min:0'],
        ]);

        $dispute = Dispute::query()->where('uuid', $uuid)->firstOrFail();
        $before = $dispute->only(['status', 'resolution', 'resolved_by']);
        $dispute = $this->deals->resolveDispute(
            $request->user(),
            $dispute,
            $data['in_favor_of'],
            $data['resolution'] ?? null,
            isset($data['buyer_kopecks']) ? (int) $data['buyer_kopecks'] : null,
            isset($data['seller_kopecks']) ? (int) $data['seller_kopecks'] : null,
        );

        // Здесь решается, кому достанутся деньги покупателя. Без записи
        // «кто отдал 400 ₽ продавцу» восстановить нельзя ничем.
        $audit->log($request->user(), 'admin.disputes.resolve', $dispute, $before, [
            'in_favor_of' => $data['in_favor_of'],
            'buyer_kopecks' => $data['buyer_kopecks'] ?? null,
            'seller_kopecks' => $data['seller_kopecks'] ?? null,
            'resolution' => $data['resolution'] ?? null,
            'deal_uuid' => $dispute->safeDeal?->uuid,
        ], $request);

        return response()->json([
            'data' => [
                'uuid' => $dispute->uuid,
                'status' => $dispute->status->value,
                'deal' => $this->deals->toArray($dispute->safeDeal->fresh()),
            ],
            'message' => 'Спор разрешён.',
        ]);
    }
}
