<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PromoPool;
use App\Support\FirstHundredPromo;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['required', 'date'],
            'auto_assign_on_register' => ['sometimes', 'boolean'],
            'audience' => ['sometimes', Rule::in([
                PromoPool::AUDIENCE_ALL,
                PromoPool::AUDIENCE_NEW,
                PromoPool::AUDIENCE_SELECTED,
            ])],
            'user_ids' => ['sometimes', 'array', 'max:1000'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'plan_slug' => ['sometimes', 'string', 'max:64'],
            'bonus_kopecks' => ['sometimes', 'integer', 'min:0'],
        ]);

        $expiresAt = \Illuminate\Support\Carbon::parse($data['expires_at']);
        if ($expiresAt->lte(now())) {
            throw ValidationException::withMessages([
                'expires_at' => ['Дата окончания должна быть в будущем.'],
            ]);
        }

        $startsAt = isset($data['starts_at']) && $data['starts_at'] !== null
            ? \Illuminate\Support\Carbon::parse($data['starts_at'])
            : null;

        /*
         * Начало в прошлом разрешено — так заводят акцию, которая уже идёт.
         * А вот начало позже конца бессмысленно: такая акция не откроется
         * никогда, и молча сохранять её значило бы отдать человеку пустую
         * страницу вместо отказа.
         */
        if ($startsAt !== null && $startsAt->gte($expiresAt)) {
            throw ValidationException::withMessages([
                'starts_at' => ['Начало должно быть раньше окончания.'],
            ]);
        }

        $круг = $data['audience'] ?? PromoPool::AUDIENCE_ALL;
        $люди = array_values(array_unique(array_map('intval', $data['user_ids'] ?? [])));

        if ($круг === PromoPool::AUDIENCE_SELECTED && $люди === []) {
            throw ValidationException::withMessages([
                'user_ids' => ['Выберите хотя бы одного человека или откройте акцию всем.'],
            ]);
        }

        $pool = PromoPool::query()->create([
            'name' => $data['name'],
            'max_activations' => (int) $data['max_activations'],
            'current_activations' => 0,
            'starts_at' => $startsAt,
            'expires_at' => $expiresAt,
            'is_active' => true,
            'auto_assign_on_register' => $request->boolean('auto_assign_on_register', true),
            'audience' => $круг,
            'plan_slug' => $data['plan_slug'] ?? 'year',
            'bonus_kopecks' => (int) ($data['bonus_kopecks'] ?? 0),
        ]);

        if ($круг === PromoPool::AUDIENCE_SELECTED) {
            $pool->audienceUsers()->sync(array_fill_keys($люди, ['created_at' => now()]));
        }

        FirstHundredPromo::syncFromPool($pool);
        $audit->log($request->user(), 'admin.promo_pools.create', $pool, null, array_merge(
            $pool->toArray(),
            ['audience_user_ids' => $люди],
        ), $request);

        return response()->json(['data' => $this->serialize($pool->fresh())], 201);
    }

    /**
     * Правка идущей акции: период, места, круг.
     *
     * ПОЧЕМУ МЕСТА МОЖНО ТОЛЬКО ДОБАВЛЯТЬ. Опустить предел ниже уже
     * выданного — значит объявить выданные места несуществующими: людям
     * подписка уже начислена, `current_activations` её считает, и после
     * такой правки счётчик показывал бы «120 из 100». Расширять можно.
     */
    public function update(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $pool = $this->findPool($uuid);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:180'],
            'max_activations' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => ['sometimes', 'date'],
            'auto_assign_on_register' => ['sometimes', 'boolean'],
            'audience' => ['sometimes', Rule::in([
                PromoPool::AUDIENCE_ALL,
                PromoPool::AUDIENCE_NEW,
                PromoPool::AUDIENCE_SELECTED,
            ])],
            'user_ids' => ['sometimes', 'array', 'max:1000'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $old = $pool->toArray();
        $правки = [];

        if (array_key_exists('name', $data)) {
            $правки['name'] = $data['name'];
        }

        if (array_key_exists('max_activations', $data)) {
            $мест = (int) $data['max_activations'];
            if ($мест < (int) $pool->current_activations) {
                throw ValidationException::withMessages([
                    'max_activations' => ['Мест уже выдано '.$pool->current_activations.' — меньше сделать нельзя.'],
                ]);
            }
            $правки['max_activations'] = $мест;
        }

        $начало = array_key_exists('starts_at', $data)
            ? ($data['starts_at'] !== null ? \Illuminate\Support\Carbon::parse($data['starts_at']) : null)
            : $pool->starts_at;
        $конец = array_key_exists('expires_at', $data)
            ? \Illuminate\Support\Carbon::parse($data['expires_at'])
            : $pool->expires_at;

        if ($начало !== null && $конец !== null && $начало->gte($конец)) {
            throw ValidationException::withMessages([
                'starts_at' => ['Начало должно быть раньше окончания.'],
            ]);
        }

        if (array_key_exists('starts_at', $data)) {
            $правки['starts_at'] = $начало;
        }
        if (array_key_exists('expires_at', $data)) {
            $правки['expires_at'] = $конец;
        }
        if (array_key_exists('auto_assign_on_register', $data)) {
            $правки['auto_assign_on_register'] = (bool) $data['auto_assign_on_register'];
        }

        $круг = $data['audience'] ?? $pool->audience;
        $люди = array_key_exists('user_ids', $data)
            ? array_values(array_unique(array_map('intval', $data['user_ids'])))
            : null;

        if ($круг === PromoPool::AUDIENCE_SELECTED) {
            $итог = $люди ?? $pool->audienceUsers()->pluck('users.id')->all();
            if ($итог === []) {
                throw ValidationException::withMessages([
                    'user_ids' => ['Выберите хотя бы одного человека или откройте акцию всем.'],
                ]);
            }
        }

        if (array_key_exists('audience', $data)) {
            $правки['audience'] = $круг;
        }

        if ($правки !== []) {
            $pool->update($правки);
        }

        /*
         * Список людей переписывается только когда круг — «выбранные».
         * При возврате к «всем» связи остаются: если админ передумает
         * обратно, ему не придётся набирать двадцать человек заново, а
         * на выдачу они всё равно не влияют — `coversUser` спрашивает
         * их только при `selected`.
         */
        if ($круг === PromoPool::AUDIENCE_SELECTED && $люди !== null) {
            $pool->audienceUsers()->sync(array_fill_keys($люди, ['created_at' => now()]));
        }

        $pool = $pool->fresh();
        FirstHundredPromo::syncFromPool($pool);
        $audit->log($request->user(), 'admin.promo_pools.update', $pool, $old, $pool->toArray(), $request);

        return response()->json(['data' => $this->serialize($pool)]);
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
            // Состояние словом — считается из дат и флагов, в базе не лежит.
            'state' => $pool->state(),
            'starts_at' => $pool->starts_at?->toIso8601String(),
            'expires_at' => $pool->expires_at?->toIso8601String(),
            'is_active' => (bool) $pool->is_active,
            'auto_assign_on_register' => (bool) $pool->auto_assign_on_register,
            'audience' => (string) ($pool->audience ?? PromoPool::AUDIENCE_ALL),
            'audience_users' => $pool->audienceUsers()
                ->get(['users.id', 'users.name', 'users.email'])
                ->map(fn ($u) => [
                    'id' => (int) $u->id,
                    'name' => (string) ($u->name ?: $u->email),
                    'email' => (string) $u->email,
                ])->all(),
            'is_granting' => $pool->isGranting(),
            'plan_slug' => $pool->plan_slug,
            'bonus_kopecks' => (int) $pool->bonus_kopecks,
            'paused_at' => $pool->paused_at?->toIso8601String(),
            'completed_at' => $pool->completed_at?->toIso8601String(),
            'created_at' => $pool->created_at?->toIso8601String(),
        ];
    }
}
