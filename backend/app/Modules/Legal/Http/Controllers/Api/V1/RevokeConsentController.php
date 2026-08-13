<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Enums\ConsentType;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Legal\Services\ConsentService;

class RevokeConsentController extends Controller
{
    public function __invoke(string $type, Request $request, ConsentService $consents): JsonResponse
    {
        $consentType = ConsentType::tryFrom($type);
        if (! $consentType) {
            return response()->json(['message' => 'Неизвестный тип согласия.'], 422);
        }

        $log = $consents->revoke($request->user(), $consentType, $request);

        return response()->json([
            'data' => [
                'type' => $log->consent_type->value,
                'status' => $log->status->value,
                'doc_version' => $log->doc_version,
                'created_at' => $log->created_at?->toIso8601String(),
            ],
        ]);
    }
}
