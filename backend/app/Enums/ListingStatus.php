<?php

namespace App\Enums;

enum ListingStatus: string
{
    case Draft = 'draft';
    case AwaitingPayment = 'awaiting_payment';
    case PendingModeration = 'pending_moderation';
    case Published = 'published';
    case Rejected = 'rejected';
    case Revision = 'revision';
    case Unpublished = 'unpublished';
    case Sold = 'sold';
    case Expired = 'expired';
}
