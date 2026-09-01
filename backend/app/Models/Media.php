<?php

namespace App\Models;

use App\Enums\MediaStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Media\Services\MediaVariantProcessor;

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

    /**
     * Rows with no display variants yet. PostgreSQL has no json = text operator,
     * so empty JSON is matched via CAST(... AS TEXT), not where('variants', '[]').
     *
     * @param  Builder<Media>  $query
     * @return Builder<Media>
     */
    public function scopeMissingVariants(Builder $query): Builder
    {
        return $query->where(function (Builder $inner): void {
            $inner->whereNull('variants')
                ->orWhereRaw("CAST(variants AS TEXT) IN ('[]', 'null', '{}')");
        });
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

    public function getPurposeAttribute(): string
    {
        return explode('/', (string) $this->path)[1] ?? '';
    }

    public function variantPublicUrl(string $name, string $ext): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/media/'.$this->uuid.'/'.$name.'.'.$ext;
    }

    /**
     * @return array<string, array{webp?: string, jpeg?: string}>
     */
    public function publicVariantUrls(): array
    {
        return MediaVariantProcessor::publicUrls($this);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function toApiArray(): ?array
    {
        if ($this->url === null) {
            return null;
        }

        $payload = [
            'uuid' => $this->uuid,
            'url' => $this->url,
            'mime_type' => $this->mime_type,
            'width' => $this->width,
            'height' => $this->height,
            'duration' => $this->duration_seconds,
            'status' => $this->status instanceof MediaStatus ? $this->status->value : (string) $this->status,
        ];

        $variants = $this->publicVariantUrls();

        if ($variants !== []) {
            $payload['variants'] = $variants;
        }

        return $payload;
    }
}
