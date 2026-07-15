<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use App\Models\ChannelApplication;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Modules\Channel\Http\Resources\ChannelResource;
use Modules\Channel\Services\ChannelApplicationService;

#[Group('Admin — Applications', weight: 81)]
class AdminChannelApplicationsController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        $items = ChannelApplication::query()
            ->with('user.profile')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->orderByDesc('created_at')
            ->get();

        return EntityRequestResource::collection($items);
    }

    public function approve(Request $request, int $id, ChannelApplicationService $applications): JsonResponse
    {
        $application = ChannelApplication::query()->findOrFail($id);

        $channel = $applications->approve($application, $request->user());
        $channel->loadMissing('owner.profile');

        return response()->json([
            'data' => new ChannelResource($channel),
        ]);
    }

    public function reject(Request $request, int $id, ChannelApplicationService $applications): JsonResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $application = ChannelApplication::query()->findOrFail($id);

        $application = $applications->reject(
            $application,
            $request->user(),
            $request->string('reason')->toString() ?: null,
        );
        $application->load('user.profile');

        return response()->json([
            'data' => new EntityRequestResource($application),
        ]);
    }
}
