<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Admin\Http\Resources\ReportResource;
use Modules\Report\Services\ReportService;

#[Group('Admin — Moderation', weight: 10)]
class ResolveReportController extends Controller
{
    public function __invoke(Request $request, int $id, ReportService $reports): ReportResource
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(ReportService::RESOLUTIONS)],
        ]);

        $report = Report::query()->findOrFail($id);

        return ReportResource::make($reports->resolve($report, $request->user(), $data['status']));
    }
}
