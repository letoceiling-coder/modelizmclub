<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityService;

class DeleteCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();

        if (! $community->isOwnedBy($user)) {
            return response()->json(['message' => 'Удалить сообщество может только владелец.'], 403);
        }

        $data = $request->validate([
            'confirm_name' => ['required', 'string', 'max:120'],
        ]);

        $communities->delete($community, $user, $data['confirm_name']);

        return response()->json([
            'data' => ['message' => 'Сообщество удалено.'],
        ]);
    }
}
