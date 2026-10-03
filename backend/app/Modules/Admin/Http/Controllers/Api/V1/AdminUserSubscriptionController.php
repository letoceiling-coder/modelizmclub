<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Admin — Users', weight: 30)]
class AdminUserSubscriptionController extends Controller
{
    #[Endpoint(
        title: 'Управление подпиской пользователя',
        description: 'action=activate — выдать/продлить подписку на N дней; '
            . 'action=extend — добавить N дней к текущей; action=deactivate — снять подписку.',
    )]
    #[PathParameter('uuid', description: 'UUID пользователя')]
    #[BodyParameter('action', description: 'activate|extend|deactivate', example: 'activate')]
    #[BodyParameter('days', required: false, description: 'Срок в днях для activate/extend', example: 365)]
    public function __invoke(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:activate,extend,deactivate'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $user = User::query()->where('uuid', $uuid)->first();
        if (! $user) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $current = UserSubscription::query()
            ->where('user_id', $user->id)
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->first();

        $old = $current?->only(['status', 'ends_at', 'auto_renew']);
        $action = $data['action'];
        $days = (int) ($data['days'] ?? 365);

        if ($action === 'deactivate') {
            if (! $current) {
                return response()->json(['message' => 'Подписка не найдена.'], 404);
            }
            $current->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'auto_renew' => false,
                'ends_at' => now(),
            ]);
            $subscription = $current;
        } else {
            /*
             * Выдача не укорачивает живой срок.
             *
             * Раньше `activate` считал от `now()`, и у человека с живой
             * подпиской один клик отнимал остаток: у 1201 строка до
             * 24.02.2027 превратилась бы в 02.11.2026 — шестнадцать месяцев
             * в минус, и вернуть их можно только из `audit_logs.old_values`.
             * Выбор между «выдать» и «продлить» делает кнопка на экране по
             * тому, что она про человека знает, — и 03.10 этот выбор уже
             * съехал: признак доступа у 1201 стал false, кнопка назвалась
             * «Выдать подписку» и послала бы `activate`.
             *
             * Поэтому укорачивание тут невозможно вовсе, каким бы ни было
             * действие: оба считают от большего — от конца живой подписки
             * или от сегодня. Отнять срок — отдельное решение, и у него
             * есть своё действие `deactivate`.
             */
            $base = $current?->ends_at?->isFuture() ? $current->ends_at : now();
            $endsAt = $base->copy()->addDays($days);

            // Отметка о том, кто выдал. Без неё строка выглядела как обычная
            // неоплаченная подписка, а такие `hasActiveSubscription()` не
            // признаёт: доступ у человека не появлялся, хотя ответ и аудит
            // говорили, что подписка активна.
            $grantedBy = $request->user()?->id;

            if ($current) {
                $current->update([
                    'status' => 'active',
                    'starts_at' => $current->starts_at ?? now(),
                    'ends_at' => $endsAt,
                    'cancelled_at' => null,
                    'auto_renew' => false,
                    'granted_by_admin_id' => $grantedBy,
                ]);
                $subscription = $current;
            } else {
                $subscription = UserSubscription::query()->create([
                    'user_id' => $user->id,
                    'plan_id' => SubscriptionPlan::query()->orderBy('sort_order')->value('id'),
                    'granted_by_admin_id' => $grantedBy,
                    'status' => 'active',
                    'starts_at' => now(),
                    'ends_at' => $endsAt,
                    'auto_renew' => false,
                ]);
            }
        }

        $audit->log(
            $request->user(),
            'admin.users.subscription.'.$action,
            $user,
            $old,
            $subscription->only(['status', 'ends_at', 'auto_renew']),
            $request,
        );

        return response()->json(['data' => [
            'status' => $subscription->status === 'active' && $subscription->ends_at?->isFuture()
                ? 'active'
                : ($subscription->status === 'active' ? 'expired' : $subscription->status),
            'is_active' => $subscription->status === 'active' && ($subscription->ends_at === null || $subscription->ends_at->isFuture()),
            'ends_at' => $subscription->ends_at?->toIso8601String(),
            'auto_renew' => (bool) $subscription->auto_renew,
        ]]);
    }
}
