<?php

namespace App\Models;

use App\Enums\ReferralStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referral extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'inviter_id',
        'invitee_id',
        'status',
        'listing_credits',
        'subscription_days',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReferralStatus::class,
            'listing_credits' => 'integer',
            'subscription_days' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inviter_id');
    }

    public function invitee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invitee_id');
    }
}
