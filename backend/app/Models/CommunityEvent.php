<?php

namespace App\Models;

use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CommunityEvent extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'community_id',
        'created_by',
        'title',
        'description',
        'starts_at',
        'location_name',
        'latitude',
        'longitude',
        'cover_media_id',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attendees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'community_event_attendees', 'event_id', 'user_id')
            ->withPivot('created_at');
    }
}
