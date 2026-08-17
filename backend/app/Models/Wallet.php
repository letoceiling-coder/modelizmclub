<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Wallet extends Model
{
    protected $fillable = [
        'user_id',
        'balance_kopecks',
        'held_kopecks',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'balance_kopecks' => 'integer',
            'held_kopecks' => 'integer',
            'version' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    /** Spendable balance (excludes funds held in escrow). */
    public function availableKopecks(): int
    {
        return (int) $this->balance_kopecks;
    }
}
