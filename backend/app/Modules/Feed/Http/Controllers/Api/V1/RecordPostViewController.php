<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChannelPost;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Channel\Services\ChannelPostViewLedger;
use Modules\Feed\Services\PostService;

/**
 * Запись открыта: страница записи или окно с полной записью.
 *
 * Карточка в списке просмотром не считается. До 17.09 страница канала писала
 * просмотр каждой отрисованной записи, и у всех записей канала стояло одно
 * число: 23 у шести записей «Мастерской», 106 у пяти «Авиамоделизма
 * сегодня», по единице у пяти «Брони и диорам».
 *
 * Идентификатор — записи ленты или записи канала без зеркала: карточка
 * канала отдаёт тот, что у неё есть.
 */
class RecordPostViewController extends Controller
{
    public function __invoke(string $uuid, Request $request, PostService $posts, ChannelPostViewLedger $channelViews): JsonResponse
    {
        $viewer = $request->user('sanctum');

        if (Post::query()->where('uuid', $uuid)->exists()) {
            $post = $posts->findByUuid($uuid, $viewer);
            $counted = $posts->recordView($post, $viewer, $request);
            $views = (int) $post->views_count;
        } else {
            $channelPost = ChannelPost::query()->where('uuid', $uuid)->where('status', 'published')->firstOrFail();
            $counted = $channelViews->record($channelPost, $viewer, $request);
            $views = (int) $channelPost->views_count;
        }

        return response()->json(['data' => ['views' => $views, 'counted' => $counted]]);
    }
}
