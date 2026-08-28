<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserReview extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'author_id',
        'target_user_id',
        'safe_deal_id',
        'rating',
        'text',
        'reply',
        'replied_at',
    ];

    protected function casts(): array
    {
        return ['replied_at' => 'datetime'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }
}
