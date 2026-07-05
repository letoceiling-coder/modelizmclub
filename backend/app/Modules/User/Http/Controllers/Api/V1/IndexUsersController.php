<?php

namespace Modules\User\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\User\Http\Resources\UserCompactResource;

class IndexUsersController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $term = trim($request->string('q')->toString());
        $cityId = $request->integer('city_id') ?: null;
        $interestId = $request->integer('interest') ?: ($request->integer('category_id') ?: null);
        $sort = $request->string('sort')->toString() ?: 'newest';
        $perPage = min((int) $request->integer('per_page', 20), 50);

        $query = User::query()
            ->with('profile.avatar')
            ->where('status', UserStatus::Active)
            ->when($viewer, fn ($q) => $q->where('id', '!=', $viewer->id))
            ->whereHas('profile', function ($q) use ($term, $cityId): void {
                if ($term !== '') {
                    $q->where(function ($q) use ($term): void {
                        $q->where('display_name', 'ilike', "%{$term}%")
                            ->orWhere('slug', 'ilike', "%{$term}%");
                    });
                }
                if ($cityId) {
                    $q->where('city_id', $cityId);
                }
            })
            ->when($interestId, fn ($q) => $q->whereHas('interests', fn ($i) => $i->where('post_categories.id', $interestId)));

        $this->applySort($query, $sort);

        $paginator = $query->paginate($perPage);

        return UserCompactResource::collection($paginator)
            ->additional(['meta' => ['sort' => $sort]])
            ->response();
    }

    /**
     * Сортировка пользователей: newest, name (по display_name), popular (по подписчикам), rating.
     *
     * @param  Builder<User>  $query
     */
    private function applySort($query, string $sort): void
    {
        $sub = fn (string $column) => UserProfile::query()
            ->select($column)
            ->whereColumn('user_profiles.user_id', 'users.id')
            ->limit(1);

        match ($sort) {
            'name' => $query->orderBy($sub('display_name')),
            'popular' => $query->orderByDesc($sub('followers_count')),
            'rating' => $query->orderByDesc($sub('rating_score')),
            default => $query->orderByDesc('users.id'),
        };
    }
}
