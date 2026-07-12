<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTwoFactor extends Model
{
    protected $table = 'user_two_factor';

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'secret',
        'enabled',
        'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'enabled' => 'boolean',
            'confirmed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
