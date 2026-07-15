<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use App\Models\CommunityApplication;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Modules\Community\Http\Resources\CommunityResource;
use Modules\Community\Services\CommunityService;

#[Group('Admin — Applications', weight: 81)]
class AdminCommunityApplicationsController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        $items = CommunityApplication::query()
            ->with(['user.profile', 'category'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->orderByDesc('created_at')
            ->get();

        return EntityRequestResource::collection($items);
    }

    public function approve(Request $request, int $id, CommunityService $communities): JsonResponse
    {
        $application = CommunityApplication::query()->findOrFail($id);

        $community = $communities->approveApplication($application, $request->user());
        $community->load(['category', 'avatar', 'cover']);

        return response()->json([
            'data' => new CommunityResource($community),
        ]);
    }

    public function reject(Request $request, int $id, CommunityService $communities): JsonResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $application = CommunityApplication::query()->findOrFail($id);

        $application = $communities->rejectApplication(
            $application,
            $request->user(),
            $request->string('reason')->toString() ?: null,
        );
        $application->load(['user.profile', 'category']);

        return response()->json([
            'data' => new EntityRequestResource($application),
        ]);
    }
}
