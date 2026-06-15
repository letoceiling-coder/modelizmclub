<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Media\Http\Requests\ConfirmUploadRequest;
use Modules\Media\Services\MediaUploadService;

class ConfirmUploadController extends Controller
{
    public function __invoke(ConfirmUploadRequest $request, MediaUploadService $uploads): JsonResponse
    {
        $media = $uploads->confirm(
            $request->user(),
            $request->string('session_uuid')->toString(),
            $request->input('media_uuids', []),
        );

        return response()->json([
            'data' => collect($media)->map(fn ($item) => [
                'uuid' => $item->uuid,
                'status' => $item->status->value,
                'url' => $item->url,
            ]),
        ]);
    }
}
