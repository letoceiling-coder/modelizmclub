<?php

namespace Modules\Channel\Http\Resources;

use App\Http\Resources\Concerns\HasCanFlags;
use App\Models\ChannelPost;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChannelPost */
class ChannelPostResource extends JsonResource
{
    use HasCanFlags;

    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $isOwner = $viewer !== null && $this->author_id === $viewer->id;

        return [
            'id' => $this->uuid,
            'channel_id' => $this->whenLoaded('channel', fn () => $this->channel->uuid),
            'author_name' => $this->author?->profile?->display_name ?? $this->author?->name ?? '',
            'text' => $this->text,
            'kind' => $this->kind,
            'status' => $this->status,
            'rejection_reason' => $this->when(
                $isOwner && $this->status === 'rejected',
                $this->rejection_reason,
            ),
            'likes' => $this->likes_count,
            'views' => $this->views_count,
            'liked' => (bool) $this->viewer_liked,
            'pinned' => $this->pinned_at !== null,
            'feed_post_uuid' => $this->whenLoaded('feedPost', fn () => $this->feedPost?->uuid),
            /*
             * Комментарии живут на зеркальной записи ленты, и отвечать о них
             * должна она — тем же правилом, что в ленте (политика и стена
             * `verified`). Без этих полей страница канала показывала «0» под
             * каждой записью и открытое поле учётке без телефона: текст
             * набирался, отправка получала 403 и стирала набранное (прод 17.09).
             */
            'comments' => $this->whenLoaded('feedPost', fn () => (int) ($this->feedPost?->comments_count ?? 0)),
            'can' => $this->whenLoaded('feedPost', fn () => $this->feedCanFlags($viewer)),
            'media' => ChannelPostMediaResource::collection($this->whenLoaded('media')),
            'created_at' => ($this->published_at ?? $this->created_at)?->toIso8601String(),
        ];
    }

    /** @return array{comment: bool} */
    private function feedCanFlags(?User $viewer): array
    {
        $feedPost = $this->feedPost;
        if (! $feedPost) {
            return ['comment' => false];
        }
        // Политика ищет канал через channelPost.channel — отдаём уже
        // загруженные, иначе на списке это по два запроса на запись.
        $feedPost->setRelation('channelPost', $this->resource);

        return $this->canFlagsFor($viewer, $feedPost, ['comment']);
    }
}
