<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promocode;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
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

    #[Endpoint(title: 'Создать промокод')]
    #[BodyParameter('code', example: 'SPRING25')]
    #[BodyParameter('type', example: 'percent')]
    #[BodyParameter('value', example: 25)]
    #[BodyParameter('max_usages', example: 50)]
    #[BodyParameter('is_active', example: true)]
    public function store(UpsertPromocodeRequest $request, AuditService $audit): JsonResponse
    {
        $promocode = Promocode::query()->create($request->validated());
        $audit->log($request->user(), 'admin.promocodes.create', $promocode, null, $promocode->toArray(), $request);

        return response()->json(['data' => $promocode], 201);
    }

    #[PathParameter('code', example: SwaggerFixtures::PROMO_CODE)]
    public function show(string $code): JsonResponse
    {
        $promocode = Promocode::query()->where('code', $code)->first();

        if (! $promocode) {
            throw new NotFoundHttpException('Промокод не найден.');
        }

        return response()->json(['data' => $promocode]);
    }

    #[PathParameter('code', example: SwaggerFixtures::PROMO_CODE)]
    #[BodyParameter('value', example: 15)]
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

    #[PathParameter('code', description: 'Код для DELETE-теста (создайте SPRING25)', example: 'SPRING25')]
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
