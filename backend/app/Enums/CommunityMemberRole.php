<?php

namespace App\Enums;

enum CommunityMemberRole: string
{
    case Member = 'member';
    case Moderator = 'moderator';
    case Owner = 'owner';
}
