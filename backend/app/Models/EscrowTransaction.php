<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EscrowTransaction extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'safe_deal_id',
        'actor_id',
        'type',
        'amount_kopecks',
        'wallet_transaction_id',
        'note',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'amount_kopecks' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
