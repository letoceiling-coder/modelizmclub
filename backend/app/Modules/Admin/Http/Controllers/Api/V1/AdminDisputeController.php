<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\DisputeStatus;
use App\Http\Controllers\Controller;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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

    public function resolve(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate([
            'in_favor_of' => ['required', Rule::in(['buyer', 'seller'])],
            'resolution' => ['nullable', 'string', 'max:2000'],
        ]);

        $dispute = Dispute::query()->where('uuid', $uuid)->firstOrFail();
        $dispute = $this->deals->resolveDispute($request->user(), $dispute, $data['in_favor_of'], $data['resolution'] ?? null);

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
