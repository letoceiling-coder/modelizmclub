<?php

namespace App\Models;

use App\Enums\RuleSectionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RulePageSection extends Model
{
    protected $fillable = [
        'rule_page_id',
        'type',
        'title',
        'content',
        'position',
        'is_visible',
    ];

    protected function casts(): array
    {
        return [
            'type' => RuleSectionType::class,
            'is_visible' => 'boolean',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(RulePage::class, 'rule_page_id');
    }
}
