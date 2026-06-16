<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Admin\Http\Resources\ModerationQueueResource;
use Modules\Admin\Services\ModerationService;

#[Group('Admin — Moderation', weight: 10)]
class IndexModerationQueueController extends Controller
{
    #[QueryParameter('status', description: 'Фильтр по статусу очереди', example: 'pending')]
    #[QueryParameter('queue', description: 'Имя очереди', example: 'posts')]
    #[QueryParameter('per_page', description: 'Записей на страницу', example: 20)]
    public function __invoke(ModerationService $moderation): AnonymousResourceCollection
    {
        $items = $moderation->queue(
            status: request()->string('status')->toString() ?: null,
            queue: request()->string('queue')->toString() ?: null,
            perPage: (int) request()->integer('per_page', 20),
        );

        return ModerationQueueResource::collection($items);
    }
}
