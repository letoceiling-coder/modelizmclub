<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Legal\Services\RulePageService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ShowRulePageController extends Controller
{
    public function __invoke(string $slug, RulePageService $rules): JsonResponse
    {
        $payload = $rules->publicBySlug($slug);
        if (! $payload) {
            throw new NotFoundHttpException('Документ не найден.');
        }

        return response()->json(['data' => $payload]);
    }
}
