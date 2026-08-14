<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeliveryMethod;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Services\AuditService;

#[Group('Admin — Delivery', weight: 55)]
class AdminDeliveryMethodController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = DeliveryMethod::query()->orderBy('sort_order')->get();

        return response()->json(['data' => $rows]);
    }

    public function update(Request $request, DeliveryMethod $deliveryMethod, AuditService $audit): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $old = $deliveryMethod->toArray();
        $deliveryMethod->update($validated);
        $audit->log($request->user(), 'admin.delivery_methods.update', $deliveryMethod, $old, $deliveryMethod->fresh()->toArray(), $request);

        return response()->json(['data' => $deliveryMethod->fresh()]);
    }

    public function reorder(Request $request, AuditService $audit): JsonResponse
    {
        $validated = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['integer', Rule::exists('delivery_methods', 'id')],
        ]);

        foreach ($validated['order'] as $index => $id) {
            DeliveryMethod::query()->whereKey($id)->update(['sort_order' => ($index + 1) * 10]);
        }

        $audit->log($request->user(), 'admin.delivery_methods.reorder', null, null, ['order' => $validated['order']], $request);

        return response()->json(['data' => ['message' => 'Порядок обновлён.']]);
    }
}
