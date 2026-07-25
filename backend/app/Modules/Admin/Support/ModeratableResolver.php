<?php

namespace Modules\Admin\Support;

use App\Models\ChannelPost;
use App\Models\Community;
use App\Models\Listing;
use App\Models\Post;
use App\Models\Video;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModeratableResolver
{
    /** @var array<string, class-string<Model>> */
    private const MAP = [
        'posts' => Post::class,
        'post' => Post::class,
        'channel_posts' => ChannelPost::class,
        'channel_post' => ChannelPost::class,
        'communities' => Community::class,
        'community' => Community::class,
        'videos' => Video::class,
        'video' => Video::class,
        'listings' => Listing::class,
        'listing' => Listing::class,
    ];

    public function resolve(string $type, string $id): Model
    {
        $modelClass = self::MAP[strtolower($type)] ?? null;

        if (! $modelClass) {
            throw new NotFoundHttpException('Неизвестный тип модерации.');
        }

        $query = $modelClass::query();

        if (in_array($type, ['posts', 'post', 'channel_posts', 'channel_post', 'communities', 'community', 'videos', 'video', 'listings', 'listing'], true)) {
            $record = $query->where('uuid', $id)->first();
        } else {
            $record = $query->whereKey($id)->first();
        }

        if (! $record) {
            throw new NotFoundHttpException('Объект модерации не найден.');
        }

        return $record;
    }
}
