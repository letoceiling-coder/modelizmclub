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
            // `community` пишет страница сообщества (routes/communities.$id.tsx)
            // с тех пор, как история научилась их показывать. Правило о нём
            // не знало, и каждый заход вошедшего в сообщество давал 422.
            'kind' => ['required', 'string', Rule::in(['ad', 'profile', 'review', 'community'])],
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
