<?php

namespace App\Policies;

use App\Enums\DisputeStatus;
use App\Models\Dispute;
use App\Models\User;

class DisputePolicy
{
    public function view(User $user, Dispute $dispute): bool
    {
        return $dispute->safeDeal->involves($user) || $user->isModerator();
    }

    public function addEvidence(User $user, Dispute $dispute): bool
    {
        return $dispute->safeDeal->involves($user) && $dispute->status === DisputeStatus::Open;
    }

    public function resolve(User $user, Dispute $dispute): bool
    {
        return $user->isModerator();
    }
}
