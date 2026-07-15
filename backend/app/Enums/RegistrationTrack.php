<?php

namespace App\Enums;

enum RegistrationTrack: string
{
    case Community = 'community';
    case Listing = 'listing';
    case Social = 'social';
}
