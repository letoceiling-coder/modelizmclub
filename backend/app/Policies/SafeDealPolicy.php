<?php

namespace App\Policies;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Models\Listing;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserReview;
use Illuminate\Auth\Access\Response;

/**
 * Who may do what with a safe deal. Ownership (buyer / seller) plus the
 * coarse status gate; the fine-grained transition rules stay in
 * SafeDealService, which keeps throwing ValidationException on a wrong
 * status — the policy only decides whether this user may try at all.
 */
class SafeDealPolicy
{
    public function view(User $user, SafeDeal $deal): bool
    {
        return $deal->involves($user) || $user->isModerator();
    }

    /** Buyer opens a deal on someone else's published listing. */
    public function create(User $user, Listing $listing): bool
    {
        return (int) $listing->user_id !== (int) $user->id
            && $listing->status === ListingStatus::Published;
    }

    public function pay(User $user, SafeDeal $deal): bool
    {
        return $this->isBuyer($user, $deal) && $deal->status === SafeDealStatus::Created;
    }

    public function ship(User $user, SafeDeal $deal): bool
    {
        return $this->isSeller($user, $deal) && $deal->status === SafeDealStatus::Paid;
    }

    public function markDelivered(User $user, SafeDeal $deal): bool
    {
        return ($deal->involves($user) || $user->isModerator())
            && in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped], true);
    }

    public function confirmDelivery(User $user, SafeDeal $deal): bool
    {
        return $this->isBuyer($user, $deal)
            && in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true);
    }

    /**
     * Отменить может любая из сторон, пока товар не в пути к получателю.
     *
     * `Created` включён с 07.09: неоплаченную сделку раньше не мог отменить
     * никто, и брошенный чекаут держал объявление в резерве бессрочно.
     * Возврата там нет — сервис уводит такую сделку в expireCheckout().
     */
    public function cancel(User $user, SafeDeal $deal): bool
    {
        return ($deal->involves($user) || $user->isModerator())
            && in_array($deal->status, [
                SafeDealStatus::Created,
                SafeDealStatus::Paid,
                SafeDealStatus::Shipped,
            ], true);
    }

    public function openDispute(User $user, SafeDeal $deal): bool
    {
        return $deal->involves($user)
            && in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true);
    }

    /**
     * Оценить сделку можно один раз.
     *
     * Условие «оценка ещё не оставлена» живёт здесь, а не рядом в сериализаторе:
     * там оно уже было, но политика его не знала, и после оставленной оценки
     * `can.review` оставался истинным, пока соседнее `can_review` гасло. Два
     * поля с одним смыслом расходились.
     *
     * Отказ именной: сервис на повторную оценку отвечал понятным текстом, и
     * терять его из-за пустого 403 не хочется.
     */
    public function review(User $user, SafeDeal $deal): Response|bool
    {
        if (! $deal->involves($user) || $deal->status !== SafeDealStatus::Completed) {
            return false;
        }

        return $this->alreadyReviewed($user, $deal)
            ? Response::deny('Вы уже оставили оценку по этой сделке.')
            : true;
    }

    private function alreadyReviewed(User $user, SafeDeal $deal): bool
    {
        if ($deal->relationLoaded('reviews')) {
            return $deal->reviews->contains(fn ($row): bool => (int) $row->author_id === (int) $user->id);
        }

        return UserReview::query()
            ->where('safe_deal_id', $deal->id)
            ->where('author_id', $user->id)
            ->exists();
    }

    /** Admin release / refund of held funds. */
    public function resolve(User $user, SafeDeal $deal): bool
    {
        return $user->isModerator();
    }

    private function isBuyer(User $user, SafeDeal $deal): bool
    {
        return (int) $deal->buyer_id === (int) $user->id;
    }

    private function isSeller(User $user, SafeDeal $deal): bool
    {
        return (int) $deal->seller_id === (int) $user->id;
    }
}
