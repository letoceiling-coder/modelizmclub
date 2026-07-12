<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BonusTransaction extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'account_user_id',
        'amount',
        'type',
        'source_type',
        'source_id',
        'expires_at',
        'description',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(BonusAccount::class, 'account_user_id', 'user_id');
    }
}
