<?php

namespace App\Models;

use App\Enums\CommunityStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Community extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'category_id',
        'name',
        'slug',
        'description',
        'cover_media_id',
        'avatar_media_id',
        'status',
        'is_official',
        'members_count',
        'posts_count',
        'settings',
        'created_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => CommunityStatus::class,
            'is_official' => 'boolean',
            'settings' => 'array',
            'approved_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(CommunityCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'avatar_media_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'community_members')
            ->withPivot(['role', 'joined_at']);
    }

    public function subcategories(): HasMany
    {
        return $this->hasMany(CommunitySubcategory::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', CommunityStatus::Active);
    }
}
