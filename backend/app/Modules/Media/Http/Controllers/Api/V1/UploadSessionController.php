<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Media\Http\Requests\CreateUploadSessionRequest;
use Modules\Media\Services\MediaUploadService;

class UploadSessionController extends Controller
{
    public function store(CreateUploadSessionRequest $request, MediaUploadService $uploads): JsonResponse
    {
        $result = $uploads->createSession($request->user(), $request->validated());

        return response()->json(['data' => $result], 201);
    }
}
