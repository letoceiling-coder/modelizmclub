<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelPostView extends Model
{
    protected $fillable = [
        'channel_post_id',
        'viewer_key',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(ChannelPost::class, 'channel_post_id');
    }
}
