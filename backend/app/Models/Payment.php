<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    /** Провайдер-заглушка: платёж без банка, деньги не двигались. */
    public const STUB_PROVIDER = 'stub';

    protected $fillable = [
        'uuid',
        'user_id',
        'amount_cents',
        'currency',
        'status',
        'provider',
        'provider_payment_id',
        'idempotency_key',
        'paid_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Платёж прошёл через заглушку — это тест, а не деньги. */
    public function isTest(): bool
    {
        return $this->provider === self::STUB_PROVIDER;
    }

    /**
     * Только настоящие деньги.
     *
     * Любая сумма по платежам — выручка, итоги, отчёт — строится от этого
     * отбора. Заглушка ставит статус «оплачен» без банка: 11.09 в боевой базе
     * нашлось 13 таких платежей на 6 187 ₽, оформленных одним человеком за
     * семь секунд. В списке и выгрузке админки они видны с пометкой, а в
     * суммы попадать не должны. Сумм по платежам в коде пока нет — сторож
     * tests/Unit/PaymentSumsExcludeStubTest не даст сложить их в обход.
     */
    public function scopeCountable(Builder $query): Builder
    {
        return $query->where(function (Builder $q): void {
            $q->whereNull('provider')->orWhere('provider', '!=', self::STUB_PROVIDER);
        });
    }
}
