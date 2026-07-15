<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use App\Models\ChannelApplication;
use App\Models\CommunityApplication;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Account', weight: 20)]
class MyEntityRequestsController extends Controller
{
    /**
     * Own channel/community creation applications, newest first
     * (backend-endpoints-needed.md §27, `GET /me/entity-requests`).
     */
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $communities = CommunityApplication::query()
            ->with(['user.profile', 'category'])
            ->where('user_id', $user->id)
            ->get();

        $channels = ChannelApplication::query()
            ->with('user.profile')
            ->where('user_id', $user->id)
            ->get();

        $all = $communities->concat($channels)
            ->sortByDesc(fn ($item) => $item->created_at)
            ->values();

        return response()->json([
            'data' => EntityRequestResource::collection($all),
        ]);
    }
}
