<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\ChannelPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Channel\Services\ChannelPostService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteChannelPostController extends Controller
{
    public function __construct(
        private readonly ChannelPostService $channelPosts,
    ) {}

    public function __invoke(string $slug, string $postUuid, Request $request): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $channelPost = ChannelPost::query()
            ->where('uuid', $postUuid)
            ->where('channel_id', $channel->id)
            ->first();

        if (! $channelPost) {
            throw new NotFoundHttpException('Пост не найден.');
        }

        $this->channelPosts->delete($channel, $channelPost, $request->user('sanctum'));

        return response()->json(['message' => 'Пост удалён.']);
    }

    private function findChannel(string $slug): Channel
    {
        $channel = Channel::query()->where('slug', $slug)->first();

        if (! $channel && Str::isUuid($slug)) {
            $channel = Channel::query()->where('uuid', $slug)->first();
        }

        if (! $channel) {
            throw new NotFoundHttpException('Канал не найден.');
        }

        return $channel;
    }
}
