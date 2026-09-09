<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Feedback extends Model
{
    protected $table = 'feedback';

    protected $fillable = [
        'user_id',
        'subject',
        'message',
        'page',
        'status',
        'reply',
        'replied_at',
        'replied_by',
    ];

    protected function casts(): array
    {
        return [
            'replied_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function repliedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by');
    }

    /**
     * Обращение от гостя: отвечать в приложении некому.
     *
     * Гость оставляет email первой строкой сообщения — так его кладёт
     * `FeedbackController`, — и ответ ему уходит почтой, руками. Отличать
     * такие обращения нужно затем, что «ответ отправлен» для них означает
     * другое, и админке об этом надо сказать прямо, а не молча ничего не
     * послать.
     */
    public function isFromGuest(): bool
    {
        return $this->user_id === null;
    }
}
