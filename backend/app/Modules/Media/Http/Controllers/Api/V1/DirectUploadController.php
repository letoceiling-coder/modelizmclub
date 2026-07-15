<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\IconAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Media\Services\MediaUploadService;
use Modules\Media\Services\SvgIconSanitizer;

class DirectUploadController extends Controller
{
    public function __invoke(Request $request, MediaUploadService $uploads): JsonResponse
    {
        if ($request->input('purpose') === 'icon') {
            return $this->storeIcon($request, app(SvgIconSanitizer::class));
        }

        $request->validate([
            'purpose' => ['required', 'string', Rule::in(MediaUploadService::purposes())],
        ]);

        $purpose = $request->string('purpose')->toString();

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:'.MediaUploadService::maxSizeKb($purpose)],
            'duration' => ['nullable', 'integer', 'min:1', 'max:600'],
        ]);

        $validated['purpose'] = $purpose;

        $media = $uploads->storeUploadedFile(
            $request->user(),
            $validated['file'],
            $validated['purpose'],
            isset($validated['duration']) ? (int) $validated['duration'] : null,
        );

        return response()->json([
            'data' => [
                'uuid' => $media->uuid,
                'url' => $media->url,
                'mime_type' => $media->mime_type,
                'width' => $media->width,
                'height' => $media->height,
                'duration' => $media->duration_seconds,
                'status' => $media->status->value,
            ],
        ], 201);
    }

    /**
     * `purpose = icon` — admin-only SVG icon upload: sanitize + tokenize on
     * the server and return the created IconAsset in the response body
     * (backend-endpoints-needed.md §26, item 3). No Media row is created.
     */
    private function storeIcon(Request $request, SvgIconSanitizer $sanitizer): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Загрузка иконок доступна только администратору.'], 403);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:512'],
        ]);

        $raw = (string) file_get_contents($validated['file']->getRealPath());
        $svg = $sanitizer->sanitize($raw);

        $asset = IconAsset::create([
            'name' => pathinfo($validated['file']->getClientOriginalName(), PATHINFO_FILENAME) ?: 'icon',
            'svg' => $svg,
            'source' => 'upload',
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => [
                'id' => (string) $asset->id,
                'name' => $asset->name,
                'svg' => $asset->svg,
                'createdAt' => $asset->created_at?->toIso8601String(),
            ],
        ], 201);
    }
}
