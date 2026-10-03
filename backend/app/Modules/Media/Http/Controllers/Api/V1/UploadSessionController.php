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
        $purpose = (string) $request->validated()['purpose'];

        /*
         * Те же назначения, что и на прямой загрузке.
         *
         * До 03.10 этой проверки здесь не было вовсе: `purpose` валидировался
         * одним `Rule::in(purposes())` и принимал `icon`, `logo`, `dispute`.
         * Прямой путь `icon` перехватывал и требовал Владельца, а этот —
         * отдавал ссылку на загрузку кому угодно подтверждённому. Правило
         * вынесено в `MediaUploadService`, чтобы два пути больше не
         * расходились.
         */
        if (! MediaUploadService::purposeAllowedFor($request->user(), $purpose)) {
            abort(403, 'Это назначение загрузки доступно только администратору.');
        }

        $result = $uploads->createSession($request->user(), $request->validated());

        return response()->json(['data' => $result], 201);
    }
}
