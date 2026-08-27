<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Legal\Services\RulePageService;

class IndexRulePagesController extends Controller
{
    public function __invoke(RulePageService $rules): JsonResponse
    {
        return response()->json(['data' => $rules->hubPayload()]);
    }
}
