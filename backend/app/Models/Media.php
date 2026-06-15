<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Media extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'disk',
        'path',
        'filename',
        'mime_type',
        'size_bytes',
        'width',
        'height',
        'duration_seconds',
        'hash',
        'uploaded_by',
        'status',
        'variants',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'variants' => 'array',
            'metadata' => 'array',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
