<?php

namespace App\Policies;

use App\Models\Listing;
use App\Models\User;

class ListingPolicy
{
    // Owner or moderator — the same rule ListingService::assertOwner has
    // enforced all along; `promote` is a paid boost and stays owner-only.
    public function update(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing) || $user->isModerator();
    }

    public function delete(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing) || $user->isModerator();
    }

    public function restore(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing) || $user->isModerator();
    }

    public function promote(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing);
    }

    private function isOwner(User $user, Listing $listing): bool
    {
        return (int) $listing->user_id === (int) $user->id;
    }
}
