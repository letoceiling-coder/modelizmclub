<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;

/**
 * Карта разделов админки: кто куда входит. Одна на сервер и интерфейс.
 *
 * Роли — колонка users.role: owner — Владелец, moderator — Модератор,
 * category_admin — администратор направления (своих разделов в общей
 * админке пока нет), user — админки нет. До 19.09 Владельцем был любой
 * `admin`. Spatie снят 19.09 вместе с таблицами: на права он не влиял, а у
 * трёх сотрудников противоречил колонке (решение 17.09 — не доводить).
 *
 * До 17.09 карты было две и они расходились: маршруты делились на
 * `role:moderator,admin` и `role:admin`, а меню держало свой список ролей.
 * Заявки сообществ и каналов сервер модератору отдавал, меню прятало.
 * Теперь маршруты охраняет `admin.section:<раздел>` по этой карте, а меню
 * строится из GET /admin/access, который отдаёт её же.
 *
 * Модератор: контент, пользователи, объявления, доставка, модерация, а также
 * заявки сообществ и каналов и категории. Без настроек, платежей и ролей.
 * Внутри своих разделов у него нет действий Владельца — см. ownerOnly*.
 */
final class AdminAccess
{
    /** Разделы, общие для Владельца и Модератора. Ключи — id разделов меню. */
    private const SHARED = [
        'dashboard',
        'users',
        'content',
        'ads',
        'delivery',
        'moderation',
        'applications',
        'feedback',
        'categories',
    ];

    /** Всё остальное — Владелец. Ключ `owner` охраняет служебные маршруты без своего раздела. */
    private const OWNER_ONLY = [
        'owner',
        'monetization',
        'feedBanners',
        'events',
        'feedGuestAccess',
        'notificationPolicy',
        'landingBlocks',
        'icons',
        'reviews',
        'reviewCategories',
        'notifications',
        'analytics',
        'design',
        'media',
        'settings',
        'rulesPages',
        'legalPages',
        'footerLinks',
        'auditLog',
    ];

    public static function isStaff(?User $user): bool
    {
        return $user !== null && in_array($user->role, [UserRole::Owner, UserRole::Moderator], true);
    }

    public static function isOwner(?User $user): bool
    {
        return $user !== null && $user->role === UserRole::Owner;
    }

    public static function allows(?User $user, string $section): bool
    {
        if (self::isOwner($user)) {
            return in_array($section, self::SHARED, true) || in_array($section, self::OWNER_ONLY, true);
        }
        if ($user !== null && $user->role === UserRole::Moderator) {
            return in_array($section, self::SHARED, true);
        }

        return false;
    }

    /** @return list<string> разделы меню, без служебного `owner` */
    public static function sectionsFor(?User $user): array
    {
        return array_values(array_filter(
            [...self::SHARED, ...self::OWNER_ONLY],
            fn (string $s) => $s !== 'owner' && self::allows($user, $s),
        ));
    }

    /** Поля пользователя, которые меняет только Владелец. */
    public const OWNER_ONLY_USER_FIELDS = ['role', 'email', 'password'];

    /** Поля категории, которые меняет только Владелец: цены размещения — деньги. */
    public const OWNER_ONLY_CATEGORY_FIELDS = ['listing_price_cents', 'subscriber_listing_price_cents'];
}
