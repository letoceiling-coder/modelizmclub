<?php

namespace Modules\Community\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Community\Services\CommunityService;

class JoinCommunityController extends Controller
{
    public function __invoke(string $slug, Request $request, CommunityService $communities): JsonResponse
    {
        $community = $communities->findActiveBySlug($slug);
        $result = $communities->join($request->user(), $community, $request->string('message')->toString() ?: null);

        $messages = [
            'member' => 'Вы вступили в сообщество.',
            'pending' => 'Заявка на вступление отправлена. Дождитесь решения администратора.',
        ];

        return response()->json([
            'message' => $messages[$result['status']] ?? $messages['member'],
            'status' => $result['status'],
        ]);
    }
}
