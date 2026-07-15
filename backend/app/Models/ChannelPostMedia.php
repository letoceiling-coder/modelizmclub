<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelPostMedia extends Model
{
    protected $fillable = [
        'channel_post_id',
        'media_id',
        'sort_order',
        'type',
        'duration_seconds',
    ];

    public function channelPost(): BelongsTo
    {
        return $this->belongsTo(ChannelPost::class);
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }
}
