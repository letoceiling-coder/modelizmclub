<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PromoPool extends Model
{
    use HasPublicUuid;
    protected $fillable = [
        'uuid',
        'name',
        'max_activations',
        'current_activations',
        'expires_at',
        'is_active',
        'auto_assign_on_register',
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

    public function seatsLeft(): int
    {
        return max(0, (int) $this->max_activations - (int) $this->current_activations);
    }

    /** New users can still receive a seat. */
    public function isGranting(): bool
    {
        if (! $this->is_active || ! $this->auto_assign_on_register || $this->completed_at) {
            return false;
        }

        if ($this->expires_at !== null && $this->expires_at->lte(now())) {
            return false;
        }

        return $this->seatsLeft() > 0;
    }

    public function scopeGranting(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where('auto_assign_on_register', true)
            ->whereNull('completed_at')
            ->whereColumn('current_activations', '<', 'max_activations')
            ->where(function (Builder $q): void {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderBy('id');
    }
}
