<?php

namespace Modules\Channel\Services;

use App\Models\ChannelPost;
use App\Models\ChannelPostView;
use App\Models\Post;
use App\Models\User;
use App\Support\ViewerKey;
use Illuminate\Http\Request;

/**
 * Учёт просмотров записи канала — одна книга на запись и её зеркало в ленте.
 *
 * До 17.09 у одной записи было два независимых счётчика. Страница канала
 * писала в channel_post_views (уникально по читателю), страница записи в
 * ленте — в posts.views_count с дедупликацией по IP на шесть часов. Чтение в
 * ленте до канала не доходило, а гости за одним адресом давали ленте один
 * просмотр. На проде у шести записей «Мастерской» это было 23 в канале и 8 в
 * ленте.
 *
 * Теперь оба входа пишут сюда, и оба счётчика двигаются вместе: строка в книге
 * — плюс один и записи канала, и её зеркалу. Строка — читатель в сутки
 * (viewed_on), повторный заход в тот же день не считается.
 */
class ChannelPostViewLedger
{
    /**
     * @param  Post|null  $feedPost  зеркало, если оно уже загружено: тогда его
     *                               счётчик обновится и в памяти, и ответ API
     *                               покажет новое число.
     */
    public function record(ChannelPost $post, ?User $viewer, Request $request, ?Post $feedPost = null): bool
    {
        if ($post->status !== 'published') {
            return false;
        }

        $post->loadMissing('channel');
        if ($post->channel?->canManage($viewer) || ($viewer && (int) $post->author_id === (int) $viewer->id)) {
            return false;
        }

        $inserted = ChannelPostView::query()->insertOrIgnore([
            'channel_post_id' => $post->id,
            'viewer_key' => ViewerKey::for($viewer, $request),
            'viewed_on' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($inserted === 0) {
            return false;
        }

        $post->increment('views_count');

        if ($feedPost !== null && (int) $feedPost->id === (int) $post->feed_post_id) {
            $feedPost->increment('views_count');
        } elseif ($post->feed_post_id !== null) {
            Post::query()->whereKey($post->feed_post_id)->increment('views_count');
        }

        return true;
    }
}
