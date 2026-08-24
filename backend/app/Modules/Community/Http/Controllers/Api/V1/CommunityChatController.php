<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityHubService;
use Modules\Community\Services\CommunityService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class CommunityChatController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities, CommunityHubService $hub): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $user = $request->user();
        $isMember = $community->members()->where('users.id', $user->id)->exists()
            || $community->isOwnedBy($user);

        if (! $isMember) {
            throw new AccessDeniedHttpException('Чат доступен только участникам сообщества.');
        }

        $conversation = $hub->addToChat($community, $user);

        return response()->json([
            'data' => [
                'conversation_uuid' => $conversation->uuid,
            ],
        ]);
    }
}
