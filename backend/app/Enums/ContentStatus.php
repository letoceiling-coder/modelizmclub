<?php

namespace App\Enums;

enum ContentStatus: string
{
    case Draft = 'draft';
    case PendingModeration = 'pending_moderation';
    case Published = 'published';
    case Rejected = 'rejected';
    case Hidden = 'hidden';
    case Revision = 'revision';
    case Archived = 'archived';
}
