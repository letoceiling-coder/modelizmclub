<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProfile extends Model
{
    public const DEFAULT_PRIVACY = [
        'profile_visibility' => 'public',
        'show_email' => false,
        'show_activity' => true,
    ];

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'display_name',
        'slug',
        'avatar_media_id',
        'city_id',
        'bio',
        'privacy_settings',
    ];

    protected function casts(): array
    {
        return [
            'privacy_settings' => 'array',
            'rating_score' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'avatar_media_id');
    }
}
