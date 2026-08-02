<?php

namespace Modules\Video\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\Video\Http\Resources\VideoResource;
use Modules\Video\Services\VideoService;

class ScheduleVideoController extends Controller
{
    public function __invoke(string $uuid, Request $request, VideoService $videos): JsonResponse
    {
        $video = $videos->adminShow($uuid);

        $data = $request->validate([
            'scheduled_at' => ['nullable', 'date'],
            'scheduled_at_local' => ['nullable', 'date'],
            'timezone' => ['nullable', 'timezone:all'],
        ]);

        if ($request->filled('scheduled_at_local')) {
            $scheduledAt = Carbon::parse(
                $request->string('scheduled_at_local')->toString(),
                $request->string('timezone', config('app.timezone'))->toString(),
            )->utc();
        } else {
            $scheduledAt = $request->date('scheduled_at');
        }

        if (! $scheduledAt) {
            return response()->json(['message' => 'Укажите дату публикации.'], 422);
        }

        $video = $videos->schedule($video, $request->user(), $scheduledAt);

        return (new VideoResource($video))->response();
    }
}
