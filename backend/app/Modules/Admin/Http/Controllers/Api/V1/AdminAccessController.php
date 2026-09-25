<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\PostCategory;
use App\Support\AdminAccess;
use App\Support\CategoryScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Разделы админки, доступные текущему сотруднику, — по той же карте, что
 * охраняет маршруты. Для администратора направления — ещё и его
 * направления: интерфейс показывает, чем он ограничен.
 */
class AdminAccessController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $sections = AdminAccess::sectionsFor($user);
        if ($sections === []) {
            return response()->json(['message' => 'Нет доступа к админке.'], 403);
        }

        $categoryIds = $user->role === UserRole::CategoryAdmin ? CategoryScope::assignedCategoryIds($user) : [];

        return response()->json(['data' => [
            'role' => $user->role->value,
            'is_owner' => AdminAccess::isOwner($user),
            'sections' => $sections,
            'capabilities' => AdminAccess::capabilitiesFor($user),
            // Что из доступного пришло не от роли, а выдано отдельно (C3).
            'granted' => AdminAccess::grantsOf($user),
            'categories' => PostCategory::query()
                ->whereIn('id', $categoryIds)
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->map(fn (PostCategory $c) => ['id' => $c->id, 'name' => $c->name, 'slug' => $c->slug])
                ->all(),
        ]]);
    }
}
