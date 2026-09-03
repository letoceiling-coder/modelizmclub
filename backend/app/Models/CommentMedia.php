<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommentMedia extends Model
{
    protected $table = 'comment_media';

    protected $fillable = [
        'comment_id',
        'media_id',
        'sort_order',
    ];

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }
}
