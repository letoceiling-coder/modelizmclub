<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelPostLike extends Model
{
    protected $fillable = [
        'channel_post_id',
        'user_id',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(ChannelPost::class, 'channel_post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
