<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Media\Http\Requests\FailUploadRequest;
use Modules\Media\Services\MediaUploadService;

class FailUploadController extends Controller
{
    public function __invoke(FailUploadRequest $request, MediaUploadService $uploads): JsonResponse
    {
        $uploads->fail($request->user(), $request->input('media_uuids', []));

        return response()->json(['message' => 'Загрузка отмечена как неуспешная.']);
    }
}
