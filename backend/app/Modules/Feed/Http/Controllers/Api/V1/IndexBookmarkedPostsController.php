<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Endpoint;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\FeedService;

/**
 * Сохранённые записи — списком с сервера.
 *
 * До 27.09 такого адреса не было: закладки хранились в `post_bookmarks`, а
 * вкладка «Сохранённое» отбирала их из уже загруженной страницы общей ленты.
 * Приёмка замерила последствие — сохранённое видно только из первых двадцати
 * записей, а ушедшее из ленты не видно никогда.
 */
#[Group('Feed', weight: 20)]
class IndexBookmarkedPostsController extends Controller
{
    #[Endpoint(title: 'Сохранённые записи', description: 'Записи, отложенные текущим пользователем, в порядке сохранения.')]
    public function __invoke(Request $request, FeedService $feed): JsonResponse
    {
        $paginator = $feed->bookmarked($request->user(), (int) $request->integer('per_page', 20));

        return PostResource::collection($paginator)->response();
    }
}
