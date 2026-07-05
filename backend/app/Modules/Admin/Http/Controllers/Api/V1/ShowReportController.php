<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Report;
use Dedoc\Scramble\Attributes\Group;
use Modules\Admin\Http\Resources\ReportResource;

#[Group('Admin — Moderation', weight: 10)]
class ShowReportController extends Controller
{
    public function __invoke(int $id): ReportResource
    {
        $report = Report::query()
            ->with(['reporter', 'resolver', 'reportable'])
            ->findOrFail($id);

        return ReportResource::make($report);
    }
}
