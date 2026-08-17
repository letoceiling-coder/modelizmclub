<?php

namespace App\Models;

use App\Enums\DisputeStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispute extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'safe_deal_id',
        'opened_by',
        'reason',
        'description',
        'status',
        'resolution',
        'resolved_by',
        'resolved_at',
        'evidence',
    ];

    protected function casts(): array
    {
        return [
            'status' => DisputeStatus::class,
            'resolved_at' => 'datetime',
            'evidence' => 'array',
        ];
    }

    public function safeDeal(): BelongsTo
    {
        return $this->belongsTo(SafeDeal::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
