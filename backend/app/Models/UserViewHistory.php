<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserViewHistory extends Model
{
    protected $table = 'user_view_history';

    protected $fillable = [
        'user_id',
        'kind',
        'target_uuid',
        'title',
        'thumb',
        'viewed_at',
    ];

    protected function casts(): array
    {
        return [
            'viewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
