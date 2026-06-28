<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\ChannelPost;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Channel\Http\Resources\ChannelPostResource;
use Modules\Channel\Http\Resources\ChannelResource;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Channels', weight: 35)]
class ChannelController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $viewer = $request->user();

        $channels = Channel::query()
            ->with('owner.profile')
            ->where('is_active', true)
            ->orderByDesc('subscribers_count')
            ->get();

        $subscribedIds = $viewer
            ? DB::table('channel_subscriptions')->where('user_id', $viewer->id)->pluck('channel_id')->all()
            : [];

        $channels->each(function (Channel $c) use ($subscribedIds): void {
            $c->is_subscribed = in_array($c->id, $subscribedIds, true);
        });

        return ChannelResource::collection($channels);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $channel->loadMissing('owner.profile');

        $viewer = $request->user();
        $channel->is_subscribed = $viewer
            ? $channel->subscribers()->whereKey($viewer->id)->exists()
            : false;

        return (new ChannelResource($channel))->response();
    }

    public function posts(Request $request, string $slug): AnonymousResourceCollection
    {
        $channel = $this->findChannel($slug);
        $viewer = $request->user();
        $isOwner = $viewer !== null && $channel->owner_id === $viewer->id;

        $items = ChannelPost::query()
            ->with(['author.profile', 'channel'])
            ->where('channel_id', $channel->id)
            ->when(! $isOwner, fn ($q) => $q->where('status', 'published'))
            ->orderByDesc('created_at')
            ->paginate((int) $request->integer('per_page', 30));

        return ChannelPostResource::collection($items);
    }

    public function subscribe(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user();

        $changed = $channel->subscribers()->syncWithoutDetaching([$user->id]);
        if (! empty($changed['attached'])) {
            $channel->increment('subscribers_count');
        }

        return response()->json(['data' => ['subscribed' => true, 'subscribers' => $channel->fresh()->subscribers_count]]);
    }

    public function unsubscribe(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user();

        $detached = $channel->subscribers()->detach($user->id);
        if ($detached > 0 && $channel->subscribers_count > 0) {
            $channel->decrement('subscribers_count');
        }

        return response()->json(['data' => ['subscribed' => false, 'subscribers' => $channel->fresh()->subscribers_count]]);
    }

    public function storePost(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user();

        if ($channel->owner_id !== $user->id) {
            return response()->json(['message' => 'Публиковать может только владелец канала.'], 403);
        }

        $data = $request->validate([
            'text' => ['required', 'string', 'max:5000'],
            'kind' => ['nullable', Rule::in(['news', 'review', 'announce', 'promo'])],
        ]);

        $post = ChannelPost::query()->create([
            'channel_id' => $channel->id,
            'author_id' => $user->id,
            'text' => $data['text'],
            'kind' => $data['kind'] ?? 'news',
            'status' => 'published',
            'published_at' => now(),
        ]);

        $post->load(['author.profile', 'channel']);

        return (new ChannelPostResource($post))
            ->response()
            ->setStatusCode(201);
    }

    private function findChannel(string $slug): Channel
    {
        $channel = Channel::query()
            ->where('slug', $slug)
            ->orWhere('uuid', $slug)
            ->first();

        if (! $channel) {
            throw new NotFoundHttpException('Канал не найден.');
        }

        return $channel;
    }
}
