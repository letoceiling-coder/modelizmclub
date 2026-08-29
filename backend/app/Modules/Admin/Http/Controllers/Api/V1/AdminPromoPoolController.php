<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PromoPool;
use App\Support\FirstHundredPromo;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Billing', weight: 74)]
class AdminPromoPoolController extends Controller
{
    public function index(): JsonResponse
    {
        $pools = PromoPool::query()->latest('id')->get();

        return response()->json(['data' => $pools->map(fn (PromoPool $p) => $this->serialize($p))->all()]);
    }

    public function store(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'max_activations' => ['required', 'integer', 'min:1', 'max:100000'],
            'expires_at' => ['required', 'date'],
            'auto_assign_on_register' => ['sometimes', 'boolean'],
            'plan_slug' => ['sometimes', 'string', 'max:64'],
            'bonus_kopecks' => ['sometimes', 'integer', 'min:0'],
        ]);

        $expiresAt = \Illuminate\Support\Carbon::parse($data['expires_at']);
        if ($expiresAt->lte(now())) {
            throw ValidationException::withMessages([
                'expires_at' => ['Дата окончания должна быть в будущем.'],
            ]);
        }

        $pool = PromoPool::query()->create([
            'name' => $data['name'],
            'max_activations' => (int) $data['max_activations'],
            'current_activations' => 0,
            'expires_at' => $expiresAt,
            'is_active' => true,
            'auto_assign_on_register' => $request->boolean('auto_assign_on_register', true),
            'plan_slug' => $data['plan_slug'] ?? 'year',
            'bonus_kopecks' => (int) ($data['bonus_kopecks'] ?? 0),
        ]);

        FirstHundredPromo::syncFromPool($pool);
        $audit->log($request->user(), 'admin.promo_pools.create', $pool, null, $pool->toArray(), $request);

        return response()->json(['data' => $this->serialize($pool->fresh())], 201);
    }

    public function pause(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $pool = $this->findPool($uuid);
        $old = $pool->toArray();
        $pool->update([
            'is_active' => false,
            'paused_at' => now(),
        ]);
        FirstHundredPromo::syncFromPool($pool->fresh());
        $audit->log($request->user(), 'admin.promo_pools.pause', $pool, $old, $pool->fresh()->toArray(), $request);

        return response()->json(['data' => $this->serialize($pool->fresh())]);
    }

    public function resume(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $pool = $this->findPool($uuid);
        if ($pool->completed_at) {
            throw ValidationException::withMessages(['uuid' => ['Завершённый пул нельзя возобновить.']]);
        }

        $old = $pool->toArray();
        $pool->update([
            'is_active' => true,
            'paused_at' => null,
        ]);
        FirstHundredPromo::syncFromPool($pool->fresh());
        $audit->log($request->user(), 'admin.promo_pools.resume', $pool, $old, $pool->fresh()->toArray(), $request);

        return response()->json(['data' => $this->serialize($pool->fresh())]);
    }

    public function complete(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $pool = $this->findPool($uuid);
        $old = $pool->toArray();
        $pool->update([
            'is_active' => false,
            'auto_assign_on_register' => false,
            'completed_at' => now(),
        ]);
        FirstHundredPromo::syncFromPool($pool->fresh());
        $audit->log($request->user(), 'admin.promo_pools.complete', $pool, $old, $pool->fresh()->toArray(), $request);

        return response()->json(['data' => $this->serialize($pool->fresh())]);
    }

    private function findPool(string $uuid): PromoPool
    {
        $pool = PromoPool::query()->where('uuid', $uuid)->first();
        if (! $pool) {
            throw new NotFoundHttpException('Промо-пул не найден.');
        }

        return $pool;
    }

    /** @return array<string, mixed> */
    private function serialize(PromoPool $pool): array
    {
        return [
            'uuid' => $pool->uuid,
            'name' => $pool->name,
            'max_activations' => (int) $pool->max_activations,
            'current_activations' => (int) $pool->current_activations,
            'seats_left' => $pool->seatsLeft(),
            'expires_at' => $pool->expires_at?->toIso8601String(),
            'is_active' => (bool) $pool->is_active,
            'auto_assign_on_register' => (bool) $pool->auto_assign_on_register,
            'is_granting' => $pool->isGranting(),
            'plan_slug' => $pool->plan_slug,
            'bonus_kopecks' => (int) $pool->bonus_kopecks,
            'paused_at' => $pool->paused_at?->toIso8601String(),
            'completed_at' => $pool->completed_at?->toIso8601String(),
            'created_at' => $pool->created_at?->toIso8601String(),
        ];
    }
}
