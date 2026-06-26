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
            'purpose' => ['required', 'string', 'in:avatar,post,post_video,listing,chat'],
        ]);

        $media = $uploads->storeUploadedFile(
            $request->user(),
            $validated['file'],
            $validated['purpose'],
        );

        return response()->json([
            'data' => [
                'uuid' => $media->uuid,
                'url' => $media->url,
                'mime_type' => $media->mime_type,
                'width' => $media->width,
                'height' => $media->height,
                'status' => $media->status->value,
            ],
        ], 201);
    }
}
