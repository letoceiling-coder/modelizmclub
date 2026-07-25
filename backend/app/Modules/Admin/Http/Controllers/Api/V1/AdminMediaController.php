<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\MediaStatus;
use App\Http\Controllers\Controller;
use App\Models\Media;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Media\Services\MediaUploadService;

#[Group('Admin — Media', weight: 81)]
class AdminMediaController extends Controller
{
    /** @var list<string> */
    private const MANAGER_PURPOSES = ['icon', 'banner', 'cover', 'post', 'listing', 'avatar'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'purpose' => ['nullable', 'string', Rule::in(self::MANAGER_PURPOSES)],
            'mime' => ['nullable', 'string', Rule::in(['image', 'svg', 'png', 'jpeg', 'webp'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $purpose = $validated['purpose'] ?? null;
        $mime = $validated['mime'] ?? null;
        $perPage = (int) ($validated['per_page'] ?? 48);

        $query = Media::query()
            ->where('status', MediaStatus::Ready)
            ->orderByDesc('created_at');

        if ($purpose) {
            $query->where('path', 'like', "media/{$purpose}/%");
        } else {
            $query->where(function ($q): void {
                foreach (self::MANAGER_PURPOSES as $p) {
                    $q->orWhere('path', 'like', "media/{$p}/%");
                }
            });
        }

        match ($mime) {
            'svg' => $query->where('mime_type', 'image/svg+xml'),
            'png' => $query->where('mime_type', 'image/png'),
            'jpeg' => $query->where('mime_type', 'image/jpeg'),
            'webp' => $query->where('mime_type', 'image/webp'),
            'image' => $query->where('mime_type', 'like', 'image/%'),
            default => null,
        };

        $page = $query->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map(fn (Media $media): array => $this->toItem($media)),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function store(Request $request, MediaUploadService $uploads): JsonResponse
    {
        $validated = $request->validate([
            'purpose' => ['required', 'string', Rule::in(self::MANAGER_PURPOSES)],
            'file' => ['required', 'file', 'max:'.MediaUploadService::maxSizeKb($request->string('purpose')->toString())],
        ]);

        $purpose = $validated['purpose'];
        $media = $uploads->storeUploadedFile($request->user(), $validated['file'], $purpose);

        return response()->json(['data' => $this->toItem($media)], 201);
    }

    /** @return array<string, mixed> */
    private function toItem(Media $media): array
    {
        return [
            'uuid' => $media->uuid,
            'filename' => $media->filename,
            'mimeType' => $media->mime_type,
            'url' => $media->url,
            'width' => $media->width,
            'height' => $media->height,
            'sizeBytes' => $media->size_bytes,
            'purpose' => $media->purpose,
            'createdAt' => $media->created_at?->toIso8601String(),
        ];
    }
}
