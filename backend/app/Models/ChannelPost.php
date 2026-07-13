<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ChannelPost extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'channel_id',
        'author_id',
        'feed_post_id',
        'text',
        'kind',
        'status',
        'likes_count',
        'views_count',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'likes_count' => 'integer',
            'views_count' => 'integer',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function feedPost(): BelongsTo
    {
        return $this->belongsTo(Post::class, 'feed_post_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(ChannelPostMedia::class)->orderBy('sort_order');
    }
}
