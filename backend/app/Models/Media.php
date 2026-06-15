<?php

namespace App\Models;

use App\Enums\MediaStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

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

        $disk = Storage::disk($this->disk);

        if (method_exists($disk, 'url')) {
            return $disk->url($this->path);
        }

        return null;
    }
}
