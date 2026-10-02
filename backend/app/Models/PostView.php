<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Кто смотрел запись ленты. Строка — читатель в сутки.
 *
 * Пара к `ChannelPostView`: та же книга, но для записей ленты и с
 * `user_id` отдельной колонкой — чтобы «кто смотрел» отвечалось
 * перечислением людей, а не разбором строки `viewer_key`.
 */
class PostView extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'viewer_key',
        'viewed_on',
    ];

    protected function casts(): array
    {
        return ['viewed_on' => 'date'];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /** Гость строкой есть, человеком — нет. */
    public function viewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
