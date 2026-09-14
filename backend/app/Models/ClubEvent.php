<?php

namespace App\Models;

use App\Enums\CommunityStatus;
use App\Models\Concerns\HasPublicUuid;
use App\Models\Concerns\StoresDatesInAppTimezone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Мероприятие — у сообщества или у площадки.
 *
 * Один класс на оба вида: карточка, страница, отметка «пойду», участники и
 * напоминание у них общие, различаются права и видимость — это EventPolicy
 * и scopeVisibleTo(). См. миграцию 2026_09_14_100000_club_events_module.
 *
 * «Прошло» не хранится: опубликованное событие с starts_at в прошлом.
 */
class ClubEvent extends Model
{
    use HasPublicUuid;
    use SoftDeletes;
    use StoresDatesInAppTimezone;

    public const SCOPE_COMMUNITY = 'community';

    public const SCOPE_PLATFORM = 'platform';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    /** Предстоящих опубликованных событий на одно сообщество. */
    public const COMMUNITY_UPCOMING_LIMIT = 10;

    protected $fillable = [
        'uuid',
        'scope',
        'status',
        'community_id',
        'created_by',
        'title',
        'description',
        'starts_at',
        'location_name',
        'latitude',
        'longitude',
        'cover_media_id',
        'cancelled_at',
        'cancel_reason',
        'reminder_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class)->withTrashed();
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attendees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'club_event_attendees', 'event_id', 'user_id')
            ->withPivot('created_at');
    }

    public function isPlatform(): bool
    {
        return $this->scope === self::SCOPE_PLATFORM;
    }

    public function isPast(): bool
    {
        return $this->starts_at !== null && $this->starts_at->isPast();
    }

    /** draft | published | cancelled | past — то, что видит человек. */
    public function displayStatus(): string
    {
        if ($this->status === self::STATUS_PUBLISHED && $this->isPast()) {
            return 'past';
        }

        return (string) $this->status;
    }

    /** Опубликованные и не прошедшие. */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED)->where('starts_at', '>=', now());
    }

    /** Опубликованные прошедшие. */
    public function scopePast(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED)->where('starts_at', '<', now());
    }

    /**
     * Что человек видит в списках: события площадки — все опубликованные;
     * события сообщества — если сообщество активно. Черновики — только тем,
     * кто может их править (это решает вызывающий код через EventPolicy).
     */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query
            ->whereIn('status', [self::STATUS_PUBLISHED, self::STATUS_CANCELLED])
            ->where(function (Builder $q): void {
                $q->where('scope', self::SCOPE_PLATFORM)
                    ->orWhereHas('community', fn (Builder $c) => $c
                        ->whereNull('deleted_at')
                        ->where('status', CommunityStatus::Active));
            });
    }
}
