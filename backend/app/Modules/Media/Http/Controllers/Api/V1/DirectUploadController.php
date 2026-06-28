<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Media\Services\MediaUploadService;

class DirectUploadController extends Controller
{
    public function __invoke(Request $request, MediaUploadService $uploads): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:102400'],
            'purpose' => ['required', 'string', 'in:avatar,post,post_video,listing,chat,voice'],
            'duration' => ['nullable', 'integer', 'min:1', 'max:600'],
        ]);

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
}
