<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\FeedService;

class IndexFeedController extends Controller
{
    public function __invoke(Request $request, FeedService $feed): JsonResponse
    {
        $paginator = $feed->list([
            'filter' => $request->string('filter', 'all')->toString(),
            'category_id' => $request->integer('category_id') ?: null,
            'author_id' => $request->integer('author_id') ?: null,
        ], $request->user(), $request->integer('per_page', 20));

        return PostResource::collection($paginator)
            ->additional(['meta' => ['filter' => $request->input('filter', 'all')]])
            ->response();
    }
}
