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
        $filters = [
            'filter' => $request->string('filter', 'all')->toString(),
            'category_id' => $request->integer('category_id') ?: null,
            'community_id' => $request->integer('community_id') ?: null,
            'author_id' => $request->integer('author_id') ?: null,
            'q' => $request->string('q')->toString() ?: null,
            'hashtag' => $request->string('hashtag')->toString() ?: null,
            'date_from' => $request->date('date_from'),
            'date_to' => $request->date('date_to'),
            'sort' => $request->string('sort')->toString() ?: 'new',
        ];

        if ($request->has('has_media')) {
            $filters['has_media'] = $request->boolean('has_media');
        }

        $paginator = $feed->list($filters, $request->user('sanctum'), min($request->integer('per_page', 20), 50));

        return PostResource::collection($paginator)
            ->additional(['meta' => [
                'filter' => $filters['filter'],
                'sort' => $filters['sort'],
            ]])
            ->response();
    }
}
