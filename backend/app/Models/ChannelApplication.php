<?php

namespace App\Models;

use App\Enums\ChannelApplicationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelApplication extends Model
{
    protected $fillable = [
        'user_id',
        'proposed_name',
        'proposed_slug',
        'proposed_kind',
        'comments_enabled',
        'description',
        'category',
        'avatar_media_id',
        'banner_media_id',
        'status',
        'moderator_comment',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'comments_enabled' => 'boolean',
            'status' => ChannelApplicationStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
