<?php

namespace Modules\Feed\Support;

use App\Models\Media;
use App\Models\Post;
use App\Models\PostMedia;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PostMediaSync
{
    /** @param list<string> $mediaUuids */
    public function sync(Post $post, User $user, array $mediaUuids): void
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
            PostMedia::query()->where('post_id', $post->id)->delete();

            foreach ($mediaIds as $index => $mediaId) {
                $media = Media::query()->find($mediaId);

                PostMedia::create([
                    'post_id' => $post->id,
                    'media_id' => $mediaId,
                    'sort_order' => $index,
                    'type' => str_starts_with($media?->mime_type ?? '', 'video/') ? 'video' : 'image',
                    'duration_seconds' => $media?->duration_seconds,
                ]);
            }
        });
    }
}
