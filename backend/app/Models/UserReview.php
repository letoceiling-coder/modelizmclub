<?php

namespace App\Models;

use App\Enums\SafeDealStatus;
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

    /**
     * Отзыв существует только как оценка продавца покупателем по завершённой
     * безопасной сделке между ними (правило заказчика 17.09).
     *
     * Политика и сервис проверяют то же самое на входе API, но колонка
     * `safe_deal_id` допускает NULL, и любой другой путь записи — команда,
     * сидер, будущий контроллер — положил бы строку, которую чтения потом
     * молча отфильтровывают. Проверка здесь делает такую запись ошибкой.
     */
    protected static function booted(): void
    {
        static::creating(function (UserReview $review): void {
            $deal = $review->safe_deal_id !== null ? SafeDeal::query()->find($review->safe_deal_id) : null;

            $allowed = $deal !== null
                && $deal->status === SafeDealStatus::Completed
                && (int) $deal->buyer_id === (int) $review->author_id
                && (int) $deal->seller_id === (int) $review->target_user_id
                && (int) $review->author_id !== (int) $review->target_user_id;

            if (! $allowed) {
                throw new \DomainException('Отзыв оставляет только покупатель продавцу по завершённой безопасной сделке.');
            }
        });
    }

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
