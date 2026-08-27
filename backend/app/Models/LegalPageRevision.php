<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegalPageRevision extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'legal_page_id',
        'version',
        'title',
        'meta_description',
        'content_html',
        'content_md',
        'status',
        'user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(LegalPage::class, 'legal_page_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
