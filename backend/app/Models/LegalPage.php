<?php

namespace App\Models;

use App\Enums\LegalPageStatus;
use Illuminate\Database\Eloquent\Model;

class LegalPage extends Model
{
    protected $fillable = [
        'slug',
        'title',
        'content_html',
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
}
