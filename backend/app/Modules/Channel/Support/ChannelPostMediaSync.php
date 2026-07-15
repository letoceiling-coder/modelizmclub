<?php

namespace Modules\Channel\Support;

use App\Models\ChannelPost;
use App\Models\ChannelPostMedia;
use App\Models\Media;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Mirrors Modules\Feed\Support\PostMediaSync for channel posts — kept as a
 *  separate small service rather than generalizing the feed one, since that
 *  one is hardcoded to the Post/PostMedia models and is already exercised by
 *  the main feed's create-post flow; safer not to touch it. */
class ChannelPostMediaSync
{
    /** @param list<string> $mediaUuids */
    public function sync(ChannelPost $post, User $user, array $mediaUuids): void
    {
        $mediaUuids = array_values(array_unique($mediaUuids));

        if (count($mediaUuids) > 10) {
            throw ValidationException::withMessages([
                'media_ids' => ['Не более 10 файлов.'],
            ]);
        }

        $mediaIds = [];

        foreach ($mediaUuids as $uuid) {
            $media = Media::query()->where('uuid', $uuid)->first();

            if (! $media || $media->uploaded_by !== $user->id || ! $media->isReady()) {
                throw ValidationException::withMessages([
                    'media_ids' => ["Медиафайл {$uuid} недоступен."],
                ]);
            }

            $mediaIds[] = $media->id;
        }

        DB::transaction(function () use ($post, $mediaIds): void {
            ChannelPostMedia::query()->where('channel_post_id', $post->id)->delete();

            foreach ($mediaIds as $index => $mediaId) {
                $media = Media::query()->find($mediaId);

                ChannelPostMedia::create([
                    'channel_post_id' => $post->id,
                    'media_id' => $mediaId,
                    'sort_order' => $index,
                    'type' => str_starts_with($media?->mime_type ?? '', 'video/') ? 'video' : 'image',
                    'duration_seconds' => $media?->duration_seconds,
                ]);
            }
        });
    }
}
