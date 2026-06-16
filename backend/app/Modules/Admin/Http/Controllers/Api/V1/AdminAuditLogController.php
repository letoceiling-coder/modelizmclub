<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;

#[Group('Admin — System', weight: 80)]
class AdminAuditLogController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $logs = AuditLog::query()
            ->with('user')
            ->latest('created_at')
            ->paginate((int) request()->integer('per_page', 50));

        return response()->json(['data' => $logs]);
    }
}
