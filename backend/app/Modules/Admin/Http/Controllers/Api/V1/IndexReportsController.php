<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Admin\Http\Resources\ReportResource;

#[Group('Admin — Moderation', weight: 10)]
class IndexReportsController extends Controller
{
    #[QueryParameter('status', description: 'Фильтр по статусу', example: 'pending')]
    public function __invoke(): AnonymousResourceCollection
    {
        $reports = Report::query()
            ->with('reporter')
            ->when(request()->filled('status'), fn ($q) => $q->where('status', request('status')))
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return ReportResource::collection($reports);
    }
}
