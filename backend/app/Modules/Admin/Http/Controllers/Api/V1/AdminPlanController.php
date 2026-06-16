<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpsertPlanRequest;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Billing', weight: 60)]
class AdminPlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = SubscriptionPlan::query()->orderBy('sort_order')->paginate(20);

        return response()->json(['data' => $plans]);
    }

    #[Endpoint(title: 'Создать тариф')]
    #[BodyParameter('slug', example: 'premium')]
    #[BodyParameter('name', example: 'Premium')]
    #[BodyParameter('price_cents', example: 99900)]
    #[BodyParameter('period_days', example: 30)]
    #[BodyParameter('is_active', example: true)]
    public function store(UpsertPlanRequest $request, AuditService $audit): JsonResponse
    {
        $plan = SubscriptionPlan::query()->create($request->validated());
        $audit->log($request->user(), 'admin.plans.create', $plan, null, $plan->toArray(), $request);

        return response()->json(['data' => $plan], 201);
    }

    #[PathParameter('slug', description: 'Slug тарифа после seed', example: SwaggerFixtures::PLAN_BASIC_SLUG)]
    public function show(string $slug): JsonResponse
    {
        $plan = SubscriptionPlan::query()->where('slug', $slug)->first();

        if (! $plan) {
            throw new NotFoundHttpException('Тариф не найден.');
        }

        return response()->json(['data' => $plan]);
    }

    #[PathParameter('slug', example: SwaggerFixtures::PLAN_BASIC_SLUG)]
    #[BodyParameter('name', example: 'Базовый (обновлён)')]
    #[BodyParameter('price_cents', example: 0)]
    public function update(UpsertPlanRequest $request, string $slug, AuditService $audit): JsonResponse
    {
        $plan = SubscriptionPlan::query()->where('slug', $slug)->first();

        if (! $plan) {
            throw new NotFoundHttpException('Тариф не найден.');
        }

        $old = $plan->toArray();
        $plan->update($request->validated());
        $audit->log($request->user(), 'admin.plans.update', $plan, $old, $plan->fresh()->toArray(), $request);

        return response()->json(['data' => $plan->fresh()]);
    }

    #[PathParameter('slug', description: 'Slug тестового тарифа premium после CREATE', example: 'premium')]
    public function destroy(string $slug, AuditService $audit): JsonResponse
    {
        $plan = SubscriptionPlan::query()->where('slug', $slug)->first();

        if (! $plan) {
            throw new NotFoundHttpException('Тариф не найден.');
        }

        $plan->delete();
        $audit->log(request()->user(), 'admin.plans.delete', $plan, $plan->toArray(), null, request());

        return response()->json(['data' => ['message' => 'Тариф удалён.']]);
    }
}
