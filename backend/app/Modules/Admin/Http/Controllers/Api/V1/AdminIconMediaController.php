<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\MediaStatus;
use App\Http\Controllers\Controller;
use App\Models\IconAsset;
use App\Models\Media;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Admin — Design', weight: 83)]
class AdminIconMediaController extends Controller
{
    /**
     * Медиафайлы из медиаменеджера (purpose=icon), готовые к добавлению в библиотеку.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $onlyUnregistered = $request->boolean('unregistered');

        $registeredIds = IconAsset::query()
            ->whereNotNull('media_id')
            ->pluck('media_id');

        $query = Media::query()
            ->where('status', MediaStatus::Ready)
            ->where('path', 'like', 'media/icon/%')
            ->whereIn('mime_type', ['image/png', 'image/svg+xml'])
            ->orderByDesc('created_at');

        if ($onlyUnregistered) {
            $query->whereNotIn('id', $registeredIds);
        }

        $items = $query->limit(100)->get()->map(fn (Media $media): array => [
            'uuid' => $media->uuid,
            'filename' => $media->filename,
            'mimeType' => $media->mime_type,
            'url' => $media->url,
            'width' => $media->width,
            'height' => $media->height,
            'registered' => $registeredIds->contains($media->id),
            'createdAt' => $media->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $items]);
    }
}
