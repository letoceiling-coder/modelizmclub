<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Resources\UserCompactResource;

class IndexUsersController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $term = trim($request->string('q')->toString());
        $perPage = min((int) $request->integer('per_page', 20), 50);

        $query = User::query()
            ->with('profile.avatar')
            ->where('status', UserStatus::Active)
            ->when($viewer, fn ($q) => $q->where('id', '!=', $viewer->id))
            ->whereHas('profile', function ($q) use ($term): void {
                if ($term !== '') {
                    $q->where(function ($q) use ($term): void {
                        $q->where('display_name', 'ilike', "%{$term}%")
                            ->orWhere('slug', 'ilike', "%{$term}%");
                    });
                }
            })
            ->orderByDesc('id');

        $paginator = $query->paginate($perPage);

        return UserCompactResource::collection($paginator)->response();
    }
}
