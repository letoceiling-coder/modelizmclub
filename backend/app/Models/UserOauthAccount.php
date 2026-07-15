<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserOAuthAccount extends Model
{
    protected $table = 'user_oauth_accounts';

    protected $fillable = [
        'user_id',
        'provider',
        'provider_user_id',
        'token',
    ];

    protected function casts(): array
    {
        return [
            'token' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
