<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

class PendingEmailChange extends Model
{
    protected $fillable = [
        'user_id',
        'new_email',
        'code_hash',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isValid(string $code): bool
    {
        return $this->expires_at->isFuture() && Hash::check($code, $this->code_hash);
    }
}
