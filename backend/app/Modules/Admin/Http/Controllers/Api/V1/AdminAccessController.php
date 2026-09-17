<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Разделы админки, доступные текущему сотруднику, — по той же карте, что охраняет маршруты. */
class AdminAccessController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! AdminAccess::isStaff($user)) {
            return response()->json(['message' => 'Нет доступа к админке.'], 403);
        }

        return response()->json(['data' => [
            'role' => $user->role->value,
            'is_owner' => AdminAccess::isOwner($user),
            'sections' => AdminAccess::sectionsFor($user),
        ]]);
    }
}
