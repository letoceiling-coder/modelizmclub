<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promocode;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpsertPromocodeRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Billing', weight: 60)]
class AdminPromocodeController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Promocode::query()->latest()->paginate(20);

        return response()->json(['data' => $items]);
    }

    public function store(UpsertPromocodeRequest $request, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->create($request->validated());
        $audit->log($request->user(), 'admin.promocodes.create', $promocode, null, $promocode->toArray(), $request);

        return response()->json(['data' => $promocode], 201);
    }

    public function show(string $code): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        return response()->json(['data' => $promocode]);
    }

    public function update(UpsertPromocodeRequest $request, string $code, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        $old = $promocode->toArray();
        $promocode->update($request->validated());
        $audit->log($request->user(), 'admin.promocodes.update', $promocode, $old, $promocode->fresh()->toArray(), $request);

        return response()->json(['data' => $promocode->fresh()]);
    }

    public function destroy(string $code, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        $promocode->delete();
        $audit->log(request()->user(), 'admin.promocodes.delete', $promocode, $promocode->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Промокод удалён.']]);
    }
}
