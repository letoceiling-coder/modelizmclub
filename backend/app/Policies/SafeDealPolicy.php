<?php

namespace App\Policies;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Models\Listing;
use App\Models\SafeDeal;
use App\Models\User;

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

    public function cancel(User $user, SafeDeal $deal): bool
    {
        return ($deal->involves($user) || $user->isModerator())
            && in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped], true);
    }

    public function openDispute(User $user, SafeDeal $deal): bool
    {
        return $deal->involves($user)
            && in_array($deal->status, [SafeDealStatus::Paid, SafeDealStatus::Shipped, SafeDealStatus::Delivered], true);
    }

    public function review(User $user, SafeDeal $deal): bool
    {
        return $deal->involves($user) && $deal->status === SafeDealStatus::Completed;
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
