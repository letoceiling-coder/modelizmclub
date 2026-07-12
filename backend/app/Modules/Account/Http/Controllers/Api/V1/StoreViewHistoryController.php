<?php

namespace Modules\Account\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Account\Services\ViewHistoryService;

class StoreViewHistoryController extends Controller
{
    public function __invoke(Request $request, ViewHistoryService $history): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:36'],
            'kind' => ['required', 'string', Rule::in(['ad', 'profile', 'review'])],
            'title' => ['nullable', 'string', 'max:255'],
            'thumb' => ['nullable', 'string', 'max:2048'],
        ]);

        $history->record(
            $request->user(),
            $data['id'],
            $data['kind'],
            $data['title'] ?? null,
            $data['thumb'] ?? null,
        );

        return response()->json(['ok' => true]);
    }
}
