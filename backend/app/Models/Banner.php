<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Banner extends Model
{
    protected $fillable = [
        'placement',
        'title',
        'image_media_id',
        'link_url',
        'text',
        'cta_text',
        'kind',
        'until_label',
        'starts_at',
        'ends_at',
        'is_active',
        'force_visible',
        'priority',
        'is_pinned',
        'sort_order',
        'impressions_count',
        'clicks_count',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'force_visible' => 'boolean',
        ];
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'image_media_id');
    }
}
