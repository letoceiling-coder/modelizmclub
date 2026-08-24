<?php

namespace App\Models;

use App\Enums\CommunityMemberRole;
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
        'city_id',
        'name',
        'slug',
        'description',
        'rules',
        'cover_media_id',
        'avatar_media_id',
        'status',
        'is_official',
        'access_type',
        'custom_category',
        'members_count',
        'posts_count',
        'settings',
        'contacts',
        'created_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => CommunityStatus::class,
            'is_official' => 'boolean',
            'settings' => 'array',
            'contacts' => 'array',
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

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function topicCategories(): BelongsToMany
    {
        return $this->belongsToMany(PostCategory::class, 'community_topic_categories')
            ->withTimestamps();
    }

    public function events(): HasMany
    {
        return $this->hasMany(CommunityEvent::class);
    }

    public function joinRequests(): HasMany
    {
        return $this->hasMany(CommunityJoinRequest::class);
    }

    public function conversation(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Conversation::class)->where('type', 'community');
    }

    public function isOpen(): bool
    {
        return ($this->access_type ?? 'open') !== 'request';
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
            ->withPivot(['role', 'joined_at', 'last_read_post_id']);
    }

    public function subcategories(): HasMany
    {
        return $this->hasMany(CommunitySubcategory::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', CommunityStatus::Active);
    }

    public function isOwnedBy(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        if ($this->created_by !== null && (int) $this->created_by === (int) $user->id) {
            return true;
        }

        if ($this->relationLoaded('members')) {
            return $this->members->contains(
                fn (User $member) => (int) $member->id === (int) $user->id
                    && ($member->pivot->role ?? null) === CommunityMemberRole::Owner->value,
            );
        }

        return $this->members()
            ->where('users.id', $user->id)
            ->where('community_members.role', CommunityMemberRole::Owner->value)
            ->exists();
    }

    public function canManage(?User $user): bool
    {
        if ($user === null) {
            return false;
        }
        if ($this->isOwnedBy($user)) {
            return true;
        }
        if (method_exists($user, 'isModerator') && $user->isModerator()) {
            return true;
        }

        return $this->members()
            ->where('users.id', $user->id)
            ->where('community_members.role', CommunityMemberRole::Moderator->value)
            ->exists();
    }
}
