<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RulePageRevision extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'rule_page_id',
        'version',
        'title',
        'seo_title',
        'seo_description',
        'summary',
        'status',
        'content_snapshot',
        'user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'content_snapshot' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(RulePage::class, 'rule_page_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
