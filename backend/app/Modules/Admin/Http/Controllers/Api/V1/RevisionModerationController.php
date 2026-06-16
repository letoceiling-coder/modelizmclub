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
class RevisionModerationController extends Controller
{
    #[PathParameter('type', description: 'Тип объекта: posts', example: 'posts')]
    #[PathParameter('id', description: 'UUID объекта')]
    #[BodyParameter('comment', description: 'Комментарий модератора автору', required: false, example: 'Добавьте описание масштаба модели')]
    public function __invoke(
        ModerationDecisionRequest $request,
        string $type,
        string $id,
        ModerationService $moderation,
    ): JsonResponse {
        $model = $moderation->requestRevision(
            $type,
            $id,
            $request->user(),
            $request->input('comment') ?? $request->input('reason'),
        );

        return response()->json([
            'data' => [
                'message' => 'Отправлено на доработку.',
                'moderatable' => $model,
            ],
        ]);
    }
}
