<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Legal\Services\UserAccountDeletionService;

class DestroyMyAccountController extends Controller
{
    public function __invoke(Request $request, UserAccountDeletionService $deletion): JsonResponse
    {
        $request->validate([
            'confirm' => ['required', 'accepted'],
        ], [
            'confirm.accepted' => 'Подтвердите удаление аккаунта.',
        ]);

        $deletion->delete($request->user());

        return response()->json([
            'data' => ['message' => 'Аккаунт удалён.'],
        ]);
    }
}
