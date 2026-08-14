<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\BodyParameter;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\ModerationDecisionRequest;
use Modules\Admin\Services\ModerationService;

#[Group('Admin — Moderation', weight: 10)]
class RejectModerationController extends Controller
{
    #[PathParameter('type', example: 'posts')]
    #[PathParameter('id', example: SwaggerFixtures::MODERATION_POST_UUID)]
    #[BodyParameter('reason', description: 'Причина отклонения', required: false, example: 'Нарушение правил сообщества')]
    public function __invoke(
        ModerationDecisionRequest $request,
        string $type,
        string $id,
        ModerationService $moderation,
    ): JsonResponse {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $model = $moderation->reject($type, $id, $request->user(), $validated['reason']);

        return response()->json([
            'data' => [
                'message' => 'Отклонено.',
                'moderatable' => $model,
            ],
        ]);
    }
}
