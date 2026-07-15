<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Media\Services\IconAssetService;
use Modules\Media\Services\MediaUploadService;

class DirectUploadController extends Controller
{
    public function __invoke(Request $request, MediaUploadService $uploads): JsonResponse
    {
        if ($request->input('purpose') === 'icon') {
            return $this->storeIcon($request, app(IconAssetService::class));
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
     * `purpose = icon` — admin-only icon upload (SVG sanitize + tokenize, or PNG
     * via Media row). Returns the created IconAsset in the response body.
     */
    private function storeIcon(Request $request, IconAssetService $icons): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Загрузка иконок доступна только администратору.'], 403);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:svg,png', 'max:2048'],
        ]);

        $file = $validated['file'];
        $mime = $file->getMimeType() ?? $file->getClientMimeType();
        $name = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) ?: 'icon';

        if ($mime === 'image/png') {
            $asset = $icons->createFromPngUpload($file, $request->user());
        } else {
            $raw = (string) file_get_contents($file->getRealPath());
            $asset = $icons->createFromSvgString($raw, $name, $request->user());
        }

        return response()->json(['data' => $icons->toApiArray($asset)], 201);
    }
}
