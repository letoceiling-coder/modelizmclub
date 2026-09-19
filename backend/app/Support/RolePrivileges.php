<?php

namespace App\Support;

use App\Enums\UserRole;

/**
 * Льготы, которые получает человек при назначении роли (решение 19.09).
 *
 * Это умолчания, а не связь: Владелец правит любое значение после
 * назначения, и правка переживает всё, кроме следующей смены роли. Так
 * собирается, например, администратор направления с квотой без ограничения.
 *
 * owner          — подписка не требуется, размещений без ограничения;
 * moderator      — подписка не требуется, размещений без ограничения;
 * category_admin — подписка не требуется, 10 размещений;
 * user           — обе льготы сняты.
 *
 * Счётчик израсходованного при смене роли не трогается: это история, а не
 * настройка.
 */
final class RolePrivileges
{
    public const CATEGORY_ADMIN_QUOTA = 10;

    /** @return array{subscription_exempt: bool, free_listings_quota: int, free_listings_unlimited: bool} */
    public static function defaultsFor(UserRole $role): array
    {
        return match ($role) {
            UserRole::Owner, UserRole::Moderator => [
                'subscription_exempt' => true,
                'free_listings_quota' => 0,
                'free_listings_unlimited' => true,
            ],
            UserRole::CategoryAdmin => [
                'subscription_exempt' => true,
                'free_listings_quota' => self::CATEGORY_ADMIN_QUOTA,
                'free_listings_unlimited' => false,
            ],
            UserRole::User => [
                'subscription_exempt' => false,
                'free_listings_quota' => 0,
                'free_listings_unlimited' => false,
            ],
        };
    }

    /** Поля льгот, которые меняет только Владелец. */
    public const FIELDS = ['subscription_exempt', 'free_listings_quota', 'free_listings_unlimited', 'free_listings_used'];
}
