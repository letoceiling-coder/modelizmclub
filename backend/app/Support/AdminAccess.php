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
 * Модератор: контент, пользователи, объявления, доставка, модерация, заявки
 * сообществ и каналов, категории, обзоры, уведомления и медиа. Без
 * настроек, платежей и ролей. Внутри своих разделов у него нет действий
 * Владельца — см. OWNER_ONLY_*.
 */
final class AdminAccess
{
    /**
     * Ступени ролей в админке: раздел открыт роли, чья ступень не ниже
     * объявленной. Администратор направления стоит ниже модератора, и
     * разделов со ступенью `category_admin` пока нет — свою модерацию он
     * получит отдельным этапом.
     */
    private const RANK = [
        'user' => 0,
        'category_admin' => 1,
        'moderator' => 2,
        'owner' => 3,
    ];

    /**
     * Разделы меню и минимальная роль для каждого. Ключи — id разделов меню;
     * порядок — порядок в ответе GET /admin/access.
     *
     * До 19.09 разделы Владельца лежали одной кучей за ключом `owner`, и
     * открыть модератору один из них можно было только правкой маршрутов.
     * Теперь каждый маршрут охраняет свой раздел, и смена состава — это
     * правка этого списка. Модератору 19.09 добавлены обзоры, уведомления
     * и медиа.
     */
    public const SECTIONS = [
        'dashboard' => 'moderator',
        'users' => 'moderator',
        'content' => 'moderator',
        'ads' => 'moderator',
        'delivery' => 'moderator',
        'moderation' => 'moderator',
        'applications' => 'moderator',
        'feedback' => 'moderator',
        'categories' => 'moderator',
        'reviews' => 'moderator',
        'notifications' => 'moderator',
        'media' => 'moderator',
        'monetization' => 'owner',
        'feedBanners' => 'owner',
        'events' => 'owner',
        'feedGuestAccess' => 'owner',
        'notificationPolicy' => 'owner',
        'landingBlocks' => 'owner',
        'icons' => 'owner',
        'reviewCategories' => 'owner',
        'analytics' => 'owner',
        'design' => 'owner',
        'settings' => 'owner',
        'rulesPages' => 'owner',
        'legalPages' => 'owner',
        'footerLinks' => 'owner',
        'auditLog' => 'owner',
    ];

    /**
     * Служебные ключи без пункта меню: маршруты, которые не принадлежат
     * ни одному разделу целиком. В меню не попадают.
     *
     * dashboard.full — полная сводка с деньгами (модератор видит урезанную);
     * users.manage   — создание и удаление учёток, выдача подписки, реквизиты;
     * communities    — прямое редактирование сообществ в обход заявок;
     * diagnostics    — техническая диагностика сервера.
     */
    private const SERVICE = [
        'dashboard.full' => 'owner',
        'users.manage' => 'owner',
        'communities' => 'owner',
        'diagnostics' => 'owner',
    ];

    public static function isStaff(?User $user): bool
    {
        return $user !== null && in_array($user->role, [UserRole::Owner, UserRole::Moderator], true);
    }

    public static function isOwner(?User $user): bool
    {
        return $user !== null && $user->role === UserRole::Owner;
    }

    /** Неизвестный ключ закрыт: опечатка в маршруте не должна открыть раздел. */
    public static function allows(?User $user, string $section): bool
    {
        $need = self::SECTIONS[$section] ?? self::SERVICE[$section] ?? null;
        if ($user === null || $need === null) {
            return false;
        }

        return (self::RANK[$user->role->value] ?? 0) >= self::RANK[$need];
    }

    /** @return list<string> разделы меню, доступные человеку, без служебных ключей */
    public static function sectionsFor(?User $user): array
    {
        return array_values(array_filter(
            array_keys(self::SECTIONS),
            fn (string $s) => self::allows($user, $s),
        ));
    }

    /** @return list<string> все ключи, которыми можно охранять маршрут */
    public static function keys(): array
    {
        return [...array_keys(self::SECTIONS), ...array_keys(self::SERVICE)];
    }

    /** Поля пользователя, которые меняет только Владелец: учётка и льготы. */
    public const OWNER_ONLY_USER_FIELDS = [
        'role',
        'email',
        'password',
        'subscription_exempt',
        'free_listings_quota',
        'free_listings_unlimited',
        'free_listings_used',
    ];

    /** Поля категории, которые меняет только Владелец: цены размещения — деньги. */
    public const OWNER_ONLY_CATEGORY_FIELDS = ['listing_price_cents', 'subscriber_listing_price_cents'];
}
