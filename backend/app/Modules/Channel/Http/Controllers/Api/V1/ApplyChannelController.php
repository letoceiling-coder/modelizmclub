<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\EntityRequestResource;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Channel\Services\ChannelApplicationService;

#[Group('Channels', weight: 35)]
class ApplyChannelController extends Controller
{
    public function __invoke(Request $request, ChannelApplicationService $applications): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:120'],
        ]);

        $application = $applications->apply(
            user: $request->user(),
            name: $data['name'],
            description: $data['description'] ?? null,
            category: $data['category'] ?? null,
        );

        $application->load('user.profile');

        return response()->json([
            'data' => new EntityRequestResource($application),
        ], 201);
    }
}
