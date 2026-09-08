<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\IconAsset;
use App\Models\Media;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Admin\Services\AuditService;
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

    public function storeFromMedia(Request $request, IconAssetService $icons, AuditService $audit): JsonResponse
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

        $audit->log($request->user(), 'admin.icon_assets.create', $asset, null, ['media_uuid' => $media->uuid], $request);

        return response()->json(['data' => $icons->toApiArray($asset)], 201);
    }

    public function destroy(int $id, Request $request, AuditService $audit): JsonResponse
    {
        $asset = IconAsset::query()->findOrFail($id);
        $old = $asset->toArray();
        $asset->delete();

        $audit->log($request->user(), 'admin.icon_assets.delete', null, $old, null, $request);

        return response()->json(['data' => ['deleted' => true]]);
    }
}
