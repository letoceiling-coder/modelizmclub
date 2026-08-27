<?php

namespace App\Models;

use App\Enums\LegalPageStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RulePage extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'seo_title',
        'seo_description',
        'summary',
        'status',
        'version',
        'sort',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => LegalPageStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function isPublished(): bool
    {
        return $this->status === LegalPageStatus::Published;
    }

    public function sections(): HasMany
    {
        return $this->hasMany(RulePageSection::class)->orderBy('position')->orderBy('id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(RulePageRevision::class)->orderByDesc('version')->orderByDesc('id');
    }
}
