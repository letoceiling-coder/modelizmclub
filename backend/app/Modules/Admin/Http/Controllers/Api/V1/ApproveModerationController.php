<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\SwaggerFixtures;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\PathParameter;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\ModerationDecisionRequest;
use Modules\Admin\Services\ModerationService;

#[Group('Admin — Moderation', weight: 10)]
class ApproveModerationController extends Controller
{
    #[PathParameter('type', description: 'Тип объекта: posts, communities', example: 'posts')]
    #[PathParameter('id', description: 'UUID объекта на модерации (seed)', example: SwaggerFixtures::MODERATION_POST_UUID)]
    public function __invoke(
        ModerationDecisionRequest $request,
        string $type,
        string $id,
        ModerationService $moderation,
    ): JsonResponse {
        $model = $moderation->approve($type, $id, $request->user());

        return response()->json([
            'data' => [
                'message' => 'Одобрено.',
                'moderatable' => $model,
            ],
        ]);
    }
}
