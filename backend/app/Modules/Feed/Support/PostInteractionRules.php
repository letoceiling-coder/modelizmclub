<?php

namespace Modules\Feed\Support;

use App\Enums\ContentStatus;
use App\Models\Post;
use Illuminate\Validation\ValidationException;

final class PostInteractionRules
{
    public static function allowsPublicInteractions(Post $post): bool
    {
        return $post->status === ContentStatus::Published;
    }

    /**
     * @throws ValidationException
     */
    public static function assertPublicInteractionsAllowed(Post $post): void
    {
        if (! self::allowsPublicInteractions($post)) {
            throw ValidationException::withMessages([
                'post' => ['Действие недоступно для записи на модерации или неопубликованной.'],
            ]);
        }
    }
}
