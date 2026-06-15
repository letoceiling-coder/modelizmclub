<?php

namespace App\Models;

use App\Enums\ContentStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use HasPublicUuid;
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'user_id',
        'community_id',
        'subcategory_id',
        'category_id',
        'title',
        'body',
        'status',
        'rejection_reason',
        'moderated_by',
        'moderated_at',
        'repost_of_id',
        'views_count',
        'reactions_count',
        'comments_count',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ContentStatus::class,
            'moderated_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(PostCategory::class, 'category_id');
    }

    public function subcategory(): BelongsTo
    {
        return $this->belongsTo(CommunitySubcategory::class, 'subcategory_id');
    }

    public function repostOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'repost_of_id');
    }

    public function mediaItems(): HasMany
    {
        return $this->hasMany(PostMedia::class)->orderBy('sort_order');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'post_hashtags');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class);
    }

    public function comments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ContentStatus::Published);
    }

    public function scopeVisibleTo(Builder $query, ?User $viewer): Builder
    {
        $query->where(function (Builder $q) use ($viewer): void {
            $q->where('status', ContentStatus::Published);

            if ($viewer) {
                $q->orWhere(function (Builder $inner) use ($viewer): void {
                    $inner->where('user_id', $viewer->id)
                        ->whereIn('status', [
                            ContentStatus::Draft,
                            ContentStatus::PendingModeration,
                            ContentStatus::Revision,
                            ContentStatus::Rejected,
                        ]);
                });

                if ($viewer->isModerator()) {
                    $q->orWhere('status', ContentStatus::PendingModeration);
                }
            }
        });

        if ($viewer) {
            $blockedIds = $viewer->blockedUsers()->pluck('users.id')
                ->merge($viewer->blockedByUsers()->pluck('users.id'))
                ->unique()
                ->all();

            if ($blockedIds !== []) {
                $query->whereNotIn('user_id', $blockedIds);
            }
        }

        return $query;
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [
            ContentStatus::Draft,
            ContentStatus::Revision,
        ], true);
    }
}
