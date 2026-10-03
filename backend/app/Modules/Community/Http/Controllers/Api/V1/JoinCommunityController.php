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
        /*
         * Длина записки — правилом, а не «как получится».
         *
         * Колонка `community_join_requests.message` объявлена `text`, то есть
         * без потолка: 500 кБ записки дошли бы до базы и до глаз владельца
         * сообщества. 500-й отсюда не выйдет, как у реакций, но ограничение
         * всё равно наше, а не базы.
         */
        $data = $request->validate([
            'message' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $community = $communities->findActiveBySlug($slug);
        $result = $communities->join($request->user(), $community, ($data['message'] ?? null) ?: null);

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
