<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LandingSection extends Model
{
    protected $fillable = [
        'slug',
        'eyebrow',
        'title',
        'subtitle',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    public function cards(): HasMany
    {
        return $this->hasMany(LandingCard::class, 'section_slug', 'slug')
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
