<?php

namespace App\Enums;

enum UserRole: string
{
    case User = 'user';
    case Subscriber = 'subscriber';
    case Moderator = 'moderator';
    case Admin = 'admin';
}
