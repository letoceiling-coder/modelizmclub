<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\ModerationDecisionRequest;
use Modules\Admin\Services\ModerationService;

#[Group('Admin — Moderation', weight: 10)]
class RejectModerationController extends Controller
{
    #[PathParameter('type', description: 'Тип объекта: posts, communities', example: 'posts')]
    #[PathParameter('id', description: 'UUID объекта')]
    #[BodyParameter('reason', description: 'Причина отклонения', required: false, example: 'Нарушение правил сообщества')]
    public function __invoke(
        ModerationDecisionRequest $request,
        string $type,
        string $id,
        ModerationService $moderation,
    ): JsonResponse {
        $model = $moderation->reject($type, $id, $request->user(), $request->input('reason'));

        return response()->json([
            'data' => [
                'message' => 'Отклонено.',
                'moderatable' => $model,
            ],
        ]);
    }
}
