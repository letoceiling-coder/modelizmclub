<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserPayoutRequisites;
use Illuminate\Http\JsonResponse;

class AdminUserPayoutRequisitesController extends Controller
{
    public function __invoke(int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        $record = UserPayoutRequisites::query()->find($user->id);

        return response()->json([
            'data' => [
                'user_id' => $user->id,
                'card_number' => $record?->payout_card_number,
            ],
        ]);
    }
}
