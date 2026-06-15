<?php

namespace Modules\Auth\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PersonalDataConsent;
use Illuminate\Http\JsonResponse;
use Modules\Auth\Http\Requests\ConsentRequest;

class ConsentController extends Controller
{
    public function __invoke(ConsentRequest $request): JsonResponse
    {
        $consent = PersonalDataConsent::create([
            'user_id' => $request->user()->id,
            'document_version' => $request->string('document_version')->toString(),
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'accepted_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'document_version' => $consent->document_version,
                'accepted_at' => $consent->accepted_at->toIso8601String(),
            ],
        ], 201);
    }
}
