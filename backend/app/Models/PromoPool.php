<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use App\Models\Concerns\StoresDatesInAppTimezone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class PromoPool extends Model
{
    use HasPublicUuid;
    use StoresDatesInAppTimezone;

    /** Состояния акции. Считаются из дат и флагов, в базе не хранятся. */
    public const STATE_PLANNED = 'planned';

    public const STATE_ACTIVE = 'active';

    public const STATE_COMPLETED = 'completed';

    public const STATE_PAUSED = 'paused';

    /** Круг: всем, кто дошёл до выдачи · только новым · только выбранным. */
    public const AUDIENCE_ALL = 'all';

    public const AUDIENCE_NEW = 'new';

    public const AUDIENCE_SELECTED = 'selected';

    protected $fillable = [
        'uuid',
        'name',
        'max_activations',
        'current_activations',
        'starts_at',
        'expires_at',
        'is_active',
        'auto_assign_on_register',
        'audience',
        'plan_slug',
        'bonus_kopecks',
        'paused_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'max_activations' => 'integer',
            'current_activations' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
            'auto_assign_on_register' => 'boolean',
            'bonus_kopecks' => 'integer',
            'paused_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Кому именно доступна акция, когда круг — «конкретные люди». */
    public function audienceUsers(): BelongsToMany
    {
        /*
         * Без withTimestamps: в связи есть только created_at, и Laravel
         * попытался бы писать updated_at, которого нет. Время проставляется
         * при записи круга.
         */
        return $this->belongsToMany(User::class, 'promo_pool_users');
    }

    /**
     * Состояние акции словом.
     *
     * Считается, а не хранится: иначе колонка расходилась бы с датами при
     * каждом часе простоя планировщика, и «активна» в базе стояло бы у
     * акции, которая кончилась вчера.
     *
     * Порядок проверок не случаен. Пауза важнее дат: приостановленная акция
     * не «активна» и не «запланирована», что бы ни говорил календарь.
     * Завершение важнее начала: у закончившейся акции начало в прошлом, и
     * без этой проверки она выглядела бы активной.
     */
    public function state(): string
    {
        if ($this->completed_at !== null) {
            return self::STATE_COMPLETED;
        }

        if (! $this->is_active || $this->paused_at !== null) {
            return self::STATE_PAUSED;
        }

        if ($this->expires_at !== null && $this->expires_at->lte(now())) {
            return self::STATE_COMPLETED;
        }

        if ($this->starts_at !== null && $this->starts_at->gt(now())) {
            return self::STATE_PLANNED;
        }

        return self::STATE_ACTIVE;
    }

    /**
     * Доступна ли акция этому человеку.
     *
     * Круг спрашивается **при выдаче**, а не при показе: список людей может
     * измениться после того, как акция началась, и решать надо по тому, что
     * стоит сейчас.
     */
    public function coversUser(User $user): bool
    {
        return match ($this->audience) {
            self::AUDIENCE_NEW => $this->starts_at === null
                || ($user->created_at !== null && $user->created_at->gte($this->starts_at)),
            self::AUDIENCE_SELECTED => DB::table('promo_pool_users')
                ->where('promo_pool_id', $this->id)
                ->where('user_id', $user->id)
                ->exists(),
            default => true,
        };
    }

    public function seatsLeft(): int
    {
        return max(0, (int) $this->max_activations - (int) $this->current_activations);
    }

    /** Места ещё можно выдавать: и по состоянию, и по датам, и по остатку. */
    public function isGranting(): bool
    {
        return $this->state() === self::STATE_ACTIVE
            && $this->auto_assign_on_register
            && $this->seatsLeft() > 0;
    }

    public function scopeGranting(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where('auto_assign_on_register', true)
            ->whereNull('completed_at')
            ->whereNull('paused_at')
            ->whereColumn('current_activations', '<', 'max_activations')
            // Ещё не началась — мест не раздаёт: в этом смысл «запланирована».
            ->where(function (Builder $q): void {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function (Builder $q): void {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderBy('id');
    }
}
