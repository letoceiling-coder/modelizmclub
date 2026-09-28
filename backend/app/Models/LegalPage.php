<?php

namespace App\Models;

use App\Enums\LegalPageStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegalPage extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'meta_description',
        'content_html',
        'content_md',
        'video_media_id',
        'status',
        'version',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => LegalPageStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function docVersionKey(): string
    {
        return $this->slug.'-v'.$this->version;
    }

    public function isPublished(): bool
    {
        return $this->status === LegalPageStatus::Published;
    }

    /**
     * Запись экрана к странице. Одна и необязательная.
     *
     * Не в разметке: `htmlFromMarkdown` вырезает сырой HTML, и вставить
     * `<video>` в текст нельзя — да и не нужно, страницы правит человек.
     */
    public function video(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'video_media_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(LegalPageRevision::class)->orderByDesc('version')->orderByDesc('id');
    }
}
