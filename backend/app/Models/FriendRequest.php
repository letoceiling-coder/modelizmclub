<?php

namespace App\Models;

use App\Enums\FriendRequestStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FriendRequest extends Model
{
    protected $fillable = [
        'from_user_id',
        'to_user_id',
        'status',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => FriendRequestStatus::class,
            'responded_at' => 'datetime',
        ];
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }
}
