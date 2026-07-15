<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\MediaStatus;
use App\Http\Controllers\Controller;
use App\Models\IconAsset;
use App\Models\Media;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Media\Services\IconAssetService;

#[Group('Admin — Design', weight: 82)]
class AdminIconAssetController extends Controller
{
    public function index(IconAssetService $icons): JsonResponse
    {
        $assets = IconAsset::query()
            ->with('media')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (IconAsset $asset): array => $icons->toApiArray($asset));

        return response()->json(['data' => $assets]);
    }

    public function storeFromMedia(Request $request, IconAssetService $icons): JsonResponse
    {
        $validated = $request->validate([
            'media_uuid' => ['required', 'uuid', 'exists:media,uuid'],
        ]);

        $media = Media::query()->where('uuid', $validated['media_uuid'])->firstOrFail();

        if ($media->purpose !== 'icon') {
            return response()->json([
                'message' => 'Медиафайл должен быть загружен с назначением icon (медиаменеджер).',
            ], 422);
        }

        $asset = $icons->createFromMedia($media, $request->user());

        return response()->json(['data' => $icons->toApiArray($asset)], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        $asset = IconAsset::query()->findOrFail($id);
        $asset->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }
}
