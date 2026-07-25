<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\ChannelPost;
use App\Models\Media;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Modules\Channel\Http\Resources\ChannelPostResource;
use Modules\Channel\Http\Resources\ChannelResource;
use Modules\Channel\Services\ChannelPostService;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Channels', weight: 35)]
class ChannelController extends Controller
{
    public function __construct(
        private readonly ChannelPostService $channelPosts,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $viewer = $request->user('sanctum');

        $channels = Channel::query()
            ->with(['owner.profile.avatar', 'avatar', 'banner'])
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
        $channel->loadMissing(['owner.profile.avatar', 'avatar', 'banner']);

        $viewer = $request->user('sanctum');
        $channel->is_subscribed = $viewer
            ? $channel->subscribers()->whereKey($viewer->id)->exists()
            : false;

        return (new ChannelResource($channel))->response();
    }

    public function posts(Request $request, string $slug): AnonymousResourceCollection
    {
        $channel = $this->findChannel($slug);
        $viewer = $request->user('sanctum');
        $isOwner = $channel->isOwnedBy($viewer);

        $items = ChannelPost::query()
            ->with(['author.profile', 'channel', 'media.media'])
            ->where('channel_id', $channel->id)
            ->when(! $isOwner, fn ($q) => $q->where('status', 'published'))
            ->orderByDesc('created_at')
            ->paginate((int) $request->integer('per_page', 30));

        return ChannelPostResource::collection($items);
    }

    public function subscribe(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user('sanctum');

        if ($channel->isOwnedBy($user)) {
            return response()->json(['message' => 'Нельзя подписаться на собственный канал.'], 422);
        }

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

        if (! $channel->isOwnedBy($user)) {
            return response()->json(['message' => 'Публиковать может только владелец канала.'], 403);
        }

        $data = $request->validate([
            'text' => ['required', 'string', 'max:5000'],
            'kind' => ['nullable', Rule::in(['news', 'review', 'announce', 'promo'])],
            'media_ids' => ['array', 'max:10'],
            'media_ids.*' => ['uuid', 'exists:media,uuid'],
        ]);
        $mediaIds = $data['media_ids'] ?? [];

        $post = DB::transaction(function () use ($channel, $user, $data, $mediaIds): ChannelPost {
            return $this->channelPosts->create($channel, $user, $data, $mediaIds);
        });

        $post->load(['author.profile', 'channel', 'media.media']);

        return (new ChannelPostResource($post))
            ->response()
            ->setStatusCode(201);
    }

    public function updateBranding(Request $request, string $slug): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user();

        if (! $channel->isOwnedBy($user)) {
            return response()->json(['message' => 'Изменять оформление может только владелец канала.'], 403);
        }

        $data = $request->validate([
            'avatar_media_uuid' => ['nullable', 'uuid'],
            'banner_media_uuid' => ['nullable', 'uuid'],
        ]);

        $updates = [];
        if (array_key_exists('avatar_media_uuid', $data)) {
            $updates['avatar_media_id'] = $this->resolveOwnedMediaId(
                $user,
                $data['avatar_media_uuid'],
                'avatar_media_uuid',
            );
        }
        if (array_key_exists('banner_media_uuid', $data)) {
            $updates['banner_media_id'] = $this->resolveOwnedMediaId(
                $user,
                $data['banner_media_uuid'],
                'banner_media_uuid',
            );
        }

        if ($updates !== []) {
            $channel->update($updates);
        }

        $channel->load(['owner.profile.avatar', 'avatar', 'banner']);

        return (new ChannelResource($channel))->response();
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

    private function resolveOwnedMediaId(User $user, ?string $uuid, string $field): ?int
    {
        if ($uuid === null || $uuid === '') {
            return null;
        }

        $media = Media::query()
            ->where('uuid', $uuid)
            ->where('uploaded_by', $user->id)
            ->first();

        if (! $media) {
            throw ValidationException::withMessages([
                $field => ['Изображение недоступно.'],
            ]);
        }

        return $media->id;
    }
}
