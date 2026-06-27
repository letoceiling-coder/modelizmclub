<?php

namespace App\Models;

use App\Enums\ConversationType;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conversation extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'type',
        'community_id',
        'title',
        'last_message_at',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'type' => ConversationType::class,
            'last_message_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * The most recent message, resolved per-conversation via a correlated
     * subquery. Used for the conversation-list preview; a plain
     * hasMany()->latest()->limit(1) eager load would (incorrectly) cap the
     * whole page to a single message row instead of one per conversation.
     */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}
