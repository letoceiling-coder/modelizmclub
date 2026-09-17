<?php

namespace Modules\Listing\Services;

use App\Models\Listing;
use App\Models\User;
use Modules\Listing\Contracts\ContactNumberProvider;
use Modules\Listing\Support\ContactNumber;

/**
 * Настоящий номер продавца из профиля — только подтверждённый по SMS.
 * Неподтверждённый номер может быть чужим.
 */
class ProfilePhoneNumberProvider implements ContactNumberProvider
{
    public function name(): string
    {
        return 'profile';
    }

    public function canProvide(Listing $listing): bool
    {
        $author = $listing->author;

        return $author !== null && filled($author->phone) && $author->phone_verified_at !== null;
    }

    public function numberFor(Listing $listing, User $viewer): ContactNumber
    {
        return new ContactNumber((string) $listing->author->phone);
    }
}
