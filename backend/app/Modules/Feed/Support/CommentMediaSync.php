<?php

namespace Modules\Feed\Support;

use App\Models\Comment;
use App\Models\CommentMedia;
use App\Models\Media;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CommentMediaSync
{
    public const MAX_FILES = 4;

    /** @param list<string> $mediaUuids */
    public function sync(Comment $comment, User $user, array $mediaUuids): void
    {
        $mediaUuids = array_values(array_unique($mediaUuids));

        if (count($mediaUuids) > self::MAX_FILES) {
            throw ValidationException::withMessages([
                'media_ids' => ['Не более 4 фотографий.'],
            ]);
        }

        $mediaIds = [];

        foreach ($mediaUuids as $uuid) {
            $media = Media::query()->where('uuid', $uuid)->first();

            if (
                ! $media
                || (int) $media->uploaded_by !== (int) $user->id
                || ! $media->isReady()
                || ! str_starts_with((string) $media->mime_type, 'image/')
            ) {
                throw ValidationException::withMessages([
                    'media_ids' => ['Прикреплённое фото недоступно. Дождитесь окончания загрузки.'],
                ]);
            }

            $mediaIds[] = $media->id;
        }

        DB::transaction(function () use ($comment, $mediaIds): void {
            CommentMedia::query()->where('comment_id', $comment->id)->delete();

            foreach ($mediaIds as $index => $mediaId) {
                CommentMedia::create([
                    'comment_id' => $comment->id,
                    'media_id' => $mediaId,
                    'sort_order' => $index,
                ]);
            }
        });
    }
}
