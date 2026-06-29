<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'session_id',
        'call_uuid',
        'platform',
        'os',
        'browser',
        'device',
        'network',
        'user_agent',
        'level',
        'tag',
        'message',
        'context',
        'client_time',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'client_time' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
