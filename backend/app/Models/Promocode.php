<?php

namespace App\Models;

use App\Models\Concerns\StoresDatesInAppTimezone;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Promocode extends Model
{
    use StoresDatesInAppTimezone;

    protected $fillable = [
        'code',
        'type',
        'scope',
        'value',
        'max_usages',
        'max_usages_per_user',
        'user_id',
        'listing_category_id',
        'valid_from',
        'valid_until',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /*
     * Форма админки шлёт дату без времени. «Действует с 01.12 до 31.12» —
     * это с начала первого дня по конец последнего, по Москве. Раньше дата
     * ложилась как 00:00, и промокод гас в начале последнего дня.
     */
    protected function validFrom(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => $this->dayBoundary($value, endOfDay: false));
    }

    protected function validUntil(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => $this->dayBoundary($value, endOfDay: true));
    }

    private function dayBoundary(mixed $value, bool $endOfDay): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $day = Carbon::parse($value, (string) config('app.timezone'));
            $value = $endOfDay ? $day->endOfDay() : $day->startOfDay();
        }

        return $this->fromDateTime($value);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function listingCategory(): BelongsTo
    {
        return $this->belongsTo(ListingCategory::class, 'listing_category_id');
    }

    public function usages(): HasMany
    {
        return $this->hasMany(PromocodeUsage::class);
    }
}
