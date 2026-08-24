<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Channel extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'owner_id',
        'name',
        'slug',
        'description',
        'category',
        'kind',
        'avatar_color',
        'banner_color',
        'avatar_media_id',
        'banner_media_id',
        'subscribers_count',
        'is_active',
        'comments_enabled',
        'rules',
        'contacts',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'comments_enabled' => 'boolean',
            'subscribers_count' => 'integer',
        ];
    }

    /** Kinds whose posts are mirrored into the public /feed. */
    public const FEED_KINDS = ['official', 'brand', 'shop'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'avatar_media_id');
    }

    public function banner(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'banner_media_id');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(ChannelPost::class);
    }

    public function subscribers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'channel_subscriptions', 'channel_id', 'user_id')
            ->withTimestamps();
    }

    public function admins(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'channel_admins', 'channel_id', 'user_id')
            ->withTimestamps();
    }

    /** Runtime-only flag for API responses (not persisted). */
    public bool $is_subscribed = false;

    public function isOwnedBy(?User $user): bool
    {
        return $user !== null
            && $this->owner_id !== null
            && (int) $this->owner_id === (int) $user->id;
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

        return $this->admins()->whereKey($user->id)->exists();
    }

    public function appearsInPublicFeed(): bool
    {
        return in_array($this->kind, self::FEED_KINDS, true);
    }
}
