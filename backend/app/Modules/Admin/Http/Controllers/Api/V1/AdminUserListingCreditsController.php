<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BonusAccount;
use App\Models\BonusTransaction;
use App\Models\User;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Начисление и списание кредитов размещения из админки (решение 19.09).
 *
 * До этого кредит появлялся двумя путями — оплата размещения без объявления
 * и рефералка, — а выдать его руками было нельзя вовсе. Каждое движение
 * пишется туда же, куда рефералка (bonus_transactions), и в журнал
 * изменений: кто, кому, сколько и почему.
 */
#[Group('Admin — Users', weight: 30)]
class AdminUserListingCreditsController extends Controller
{
    #[Endpoint(
        title: 'Кредиты размещения пользователя',
        description: 'Начислить (amount > 0) или списать (amount < 0) кредиты размещения. Только Владелец.',
    )]
    #[PathParameter('uuid', description: 'UUID пользователя')]
    #[BodyParameter('amount', description: 'Сколько начислить; отрицательное — списать', example: 1)]
    #[BodyParameter('reason', description: 'Почему — видно в журнале', example: 'Компенсация за сбой оплаты')]
    public function __invoke(Request $request, string $uuid, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'between:-100,100', 'not_in:0'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $target = User::query()->where('uuid', $uuid)->first();
        if (! $target) {
            throw new NotFoundHttpException('Пользователь не найден.');
        }

        $amount = (int) $data['amount'];

        [$before, $after] = DB::transaction(function () use ($target, $amount, $data, $request): array {
            $locked = User::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();
            $before = (int) $locked->listing_placement_credits;
            $after = $before + $amount;

            if ($after < 0) {
                throw ValidationException::withMessages([
                    'amount' => ["Списать можно не больше, чем есть: сейчас {$before}."],
                ]);
            }

            $locked->forceFill(['listing_placement_credits' => $after])->save();

            BonusAccount::query()->firstOrCreate(['user_id' => $locked->id], ['balance' => 0]);
            BonusTransaction::query()->create([
                'account_user_id' => $locked->id,
                'amount' => $amount,
                'type' => 'admin_grant',
                'source_type' => User::class,
                'source_id' => $request->user()->id,
                'description' => $data['reason'],
                'created_at' => now(),
            ]);

            return [$before, $after];
        });

        $audit->log(
            $request->user(),
            'admin.users.listing_credits',
            $target,
            ['listing_placement_credits' => $before],
            ['listing_placement_credits' => $after, 'reason' => $data['reason']],
            $request,
        );

        return response()->json(['data' => ['listing_placement_credits' => $after]]);
    }
}
