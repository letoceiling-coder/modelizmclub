<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPayoutRequisites extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'payout_card_number',
        'preferred_channel',
        'sbp_phone',
        'sbp_bank_id',
        'sbp_bank_name',
        'sbp_full_name',
        'card_last4',
    ];

    protected $hidden = [
        'payout_card_number',
        'sbp_phone',
    ];

    protected function casts(): array
    {
        return [
            'payout_card_number' => 'encrypted',
            'sbp_phone' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
