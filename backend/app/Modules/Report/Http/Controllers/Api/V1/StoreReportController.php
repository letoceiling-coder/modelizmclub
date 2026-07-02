<?php

namespace Modules\Report\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Modules\Report\Http\Requests\StoreReportRequest;
use Modules\Report\Http\Resources\ReportResource;
use Modules\Report\Services\ReportService;

#[Group('Moderation — Reports', weight: 20)]
class StoreReportController extends Controller
{
    public function __invoke(StoreReportRequest $request, ReportService $reports): JsonResponse
    {
        $report = $reports->create(
            $request->user(),
            $request->string('type')->toString(),
            $request->string('target_id')->toString(),
            $request->string('reason')->toString(),
            $request->string('description')->toString() ?: null,
        );

        return ReportResource::make($report)
            ->additional(['message' => 'Жалоба отправлена на модерацию.'])
            ->response()
            ->setStatusCode(201);
    }
}
