<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Dedoc\Scramble\Attributes\Group;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Admin\Http\Resources\ReportResource;

use Modules\Report\Services\ReportService;

#[Group('Admin — Moderation', weight: 10)]
class IndexReportsController extends Controller
{
    #[QueryParameter('status', description: 'Фильтр по статусу', example: 'pending')]
    #[QueryParameter('target_types', description: 'CSV типов: post,listing,video,community,user,...')]
    public function __invoke(): AnonymousResourceCollection
    {
        $reports = Report::query()
            ->with(['reporter', 'reportable'])
            ->when(request()->filled('status'), fn ($q) => $q->where('status', request('status')))
            ->when(request()->filled('target_types'), function ($q) {
                $keys = array_filter(array_map('trim', explode(',', (string) request('target_types'))));
                $map = ReportService::reportableTypes();
                $classes = array_values(array_filter(array_map(fn ($k) => $map[$k] ?? null, $keys)));
                if ($classes !== []) {
                    $q->whereIn('reportable_type', $classes);
                }
            })
            ->latest()
            ->paginate((int) request()->integer('per_page', 20));

        return ReportResource::collection($reports);
    }
}
