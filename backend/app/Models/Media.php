<?php

namespace App\Models;

use App\Enums\MediaStatus;
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
            'status' => MediaStatus::class,
            'variants' => 'array',
            'metadata' => 'array',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isReady(): bool
    {
        return $this->status === MediaStatus::Ready;
    }

    public function getUrlAttribute(): ?string
    {
        if ($this->status !== MediaStatus::Ready) {
            return null;
        }

        // Served via the backend media proxy so the shared, private object
        // storage never needs to be made world-readable. Stable + cacheable.
        return rtrim((string) config('app.url'), '/').'/api/v1/media/'.$this->uuid;
    }
}
