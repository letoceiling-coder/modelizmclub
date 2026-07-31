<?php

namespace Modules\Feed\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\Feed\Http\Requests\SchedulePostRequest;
use Modules\Feed\Http\Resources\PostResource;
use Modules\Feed\Services\PostService;

class SchedulePostController extends Controller
{
    public function __invoke(string $uuid, SchedulePostRequest $request, PostService $posts): JsonResponse
    {
        $post = $posts->findByUuid($uuid, $request->user());

        if ($request->filled('scheduled_at_local')) {
            $scheduledAt = Carbon::parse(
                $request->string('scheduled_at_local')->toString(),
                $request->string('timezone')->toString(),
            )->utc();
        } else {
            $scheduledAt = $request->date('scheduled_at');
        }

        $post = $posts->schedule($post, $request->user(), $scheduledAt);

        return (new PostResource($post))->response();
    }
}
