<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromocodeUsage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'promocode_id',
        'user_id',
        'payment_id',
        'status',
        'reserved_at',
        'used_at',
    ];

    /** Место занято, оплаты ещё нет. */
    public const ЗАНЯТО = 'reserved';

    /** Оплата прошла, место израсходовано. */
    public const ИЗРАСХОДОВАНО = 'used';

    protected function casts(): array
    {
        return [
            'used_at' => 'datetime',
            'reserved_at' => 'datetime',
        ];
    }

    public function promocode(): BelongsTo
    {
        return $this->belongsTo(Promocode::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
