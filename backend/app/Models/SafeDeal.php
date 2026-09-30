<?php

namespace App\Models;

use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Models\Concerns\HasPublicUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SafeDeal extends Model
{
    use HasPublicUuid;

    protected $fillable = [
        'uuid',
        'listing_id',
        'shipment_id',
        'conversation_id',
        'buyer_id',
        'seller_id',
        'amount_kopecks',
        'item_kopecks',
        'platform_fee_kopecks',
        'fee_payer',
        'seller_payout_kopecks',
        'delivery_cost_kopecks',
        'currency',
        'status',
        'hold_transaction_id',
        'payout_transaction_id',
        'refund_transaction_id',
        'delivery_method',
        'destination_point',
        'delivery_status',
        'tracking_number',
        'paid_at',
        'hold_expires_at',
        'shipped_at',
        'delivered_at',
        'auto_release_at',
        'completed_at',
        'cancelled_at',
        'metadata',
    ];

    /**
     * Отменённая сделка не хранит ни выплаты, ни комиссии.
     *
     * ПОЧЕМУ ЗДЕСЬ, А НЕ В СЕРВИСЕ. Путей в отмену четыре, и 30.09 я
     * починил два: `refundBuyer` и разделение спора. Ревью нашло два
     * оставшихся — `expireCheckout` (через него идёт любая отклонённая
     * банком карта и брошенный чекаут) и провал предавторизации в
     * `create`. По ним колонки остались бы с планом, и строка выглядела
     * бы так: «Исход — возврат покупателю, комиссия 50 ₽» — сама себе
     * противоречащая.
     *
     * Третья заплата ничего бы не гарантировала: пятый путь появился бы
     * тем же способом. Поэтому обнуление принадлежит **переходу**, а не
     * месту вызова: строка со статусом «отменена» или «возвращена»
     * физически не может нести ненулевые деньги.
     *
     * Разделения спора это не касается: там статус `completed`, а долю
     * продавца и ноль комиссии пишет `splitPayout` — величины, которые
     * знает только он.
     */
    protected static function booted(): void
    {
        static::saving(function (self $deal): void {
            $status = $deal->status instanceof SafeDealStatus
                ? $deal->status
                : SafeDealStatus::tryFrom((string) $deal->status);

            if (in_array($status, [SafeDealStatus::Cancelled, SafeDealStatus::Refunded], true)) {
                $deal->seller_payout_kopecks = 0;
                $deal->platform_fee_kopecks = 0;
            }
        });
    }

    protected function casts(): array
    {
        return [
            'status' => SafeDealStatus::class,
            'amount_kopecks' => 'integer',
            'item_kopecks' => 'integer',
            'platform_fee_kopecks' => 'integer',
            'fee_payer' => SafeDealFeePayer::class,
            'seller_payout_kopecks' => 'integer',
            'delivery_cost_kopecks' => 'integer',
            'destination_point' => 'array',
            'paid_at' => 'datetime',
            'hold_expires_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'auto_release_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /**
     * Объявление сделки — включая удалённое.
     *
     * Завершённая сделка остаётся в истории обеих сторон навсегда, а
     * объявление продавец вправе убрать. Без `withTrashed()` карточка такой
     * сделки теряла заголовок и ссылку: связь возвращала null.
     */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class)->withTrashed();
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    /** The buyer↔seller chat opened together with the deal. */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(EscrowTransaction::class);
    }

    public function dispute(): HasOne
    {
        return $this->hasOne(Dispute::class)->latestOfMany();
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(UserReview::class);
    }

    public function incomingPayments(): HasMany
    {
        return $this->hasMany(SafeDealIncomingPayment::class);
    }

    /** The VTB charge that currently backs this deal, newest first. */
    public function activeIncomingPayment(): ?SafeDealIncomingPayment
    {
        return $this->incomingPayments()
            ->whereNotIn('status', ['reversed', 'failed'])
            ->orderByDesc('id')
            ->first();
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(SafeDealPayout::class);
    }

    public function gatewayEvents(): HasMany
    {
        return $this->hasMany(SafeDealGatewayEvent::class);
    }

    public function latestIncomingPayment(): HasOne
    {
        return $this->hasOne(SafeDealIncomingPayment::class)->latestOfMany();
    }

    public function latestPayout(): HasOne
    {
        return $this->hasOne(SafeDealPayout::class)->latestOfMany();
    }

    public function involves(User $user): bool
    {
        return (int) $this->buyer_id === (int) $user->id
            || (int) $this->seller_id === (int) $user->id;
    }
}
