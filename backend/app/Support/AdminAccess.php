<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\AdminPermissionGrant;
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
     * объявленной. Администратор направления стоит ниже модератора: ему
     * открыты модерация, записи и объявления, а внутри — только его
     * направления (App\Support\CategoryScope).
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
        'content' => 'category_admin',
        'ads' => 'category_admin',
        'delivery' => 'moderator',
        'moderation' => 'category_admin',
        'applications' => 'moderator',
        'feedback' => 'moderator',
        'categories' => 'moderator',
        'reviews' => 'moderator',
        'notifications' => 'moderator',
        'media' => 'moderator',
        /*
         * Монетизация разделена на четыре вкладки 25.09. Права те же —
         * только Владелец: деньги площадки не показываем даже модератору.
         *
         * Прежний ключ оставлен: по нему проверяется достижимость старых
         * ссылок `?section=monetization`, которые ведут на «Тарифы и цены».
         */
        'monetization' => 'owner',
        'monetizationPricing' => 'owner',
        'monetizationPayments' => 'owner',
        'monetizationLedger' => 'owner',
        'monetizationPromos' => 'owner',
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
        // Кто сотрудник, какие у него льготы и направления (19.09).
        'roles' => 'owner',
    ];

    /**
     * Служебные ключи без пункта меню: маршруты, которые не принадлежат
     * ни одному разделу целиком. В меню не попадают.
     *
     * dashboard.full — полная сводка с деньгами (модератор видит урезанную);
     * users.manage   — создание и удаление учёток, выдача подписки, реквизиты;
     * communities    — прямое редактирование сообществ в обход заявок;
     * diagnostics    — техническая диагностика сервера;
     * reports        — жалобы: раздел модерации, но не для администратора
     *                  направления — жалоба бывает на что угодно;
     * posts.delete, listings.delete — удаление: администратор направления
     *                  правит и снимает, но не удаляет.
     */
    private const SERVICE = [
        'reports' => 'moderator',
        'posts.delete' => 'moderator',
        'listings.delete' => 'moderator',
        'dashboard.full' => 'owner',
        'users.manage' => 'owner',
        /*
         * Два действия Владельца внутри чужих разделов. Ключи заведены
         * ради C3: пока они проверялись через `isOwner`, выдать «этому
         * модератору ещё и цены» было нельзя — галочка открывала бы
         * раздел категорий, который у модератора и так открыт, а цены в
         * нём всё равно оставались бы заперты.
         */
        'categories.prices' => 'owner',
        'users.fields' => 'owner',
        'communities' => 'owner',
        'diagnostics' => 'owner',
    ];

    /**
     * Что можно выдать галочкой поверх роли (C3). Список разрешённого, а
     * не запрещённого: новый ключ в SECTIONS или SERVICE не должен
     * становиться выдаваемым сам собой — решение о каждом принимается
     * отдельно и здесь.
     *
     * Не выдаётся и почему:
     *
     * roles         — получивший раздаёт права дальше, в том числе себе;
     *                 роль Владельца перестаёт что-либо значить;
     * users.manage  — создание учётки с любой ролью и удаление сотрудников.
     *                 Заводится учётка с ролью Владельца, и дальше можно
     *                 всё. Сам маршрут тоже закрыт по роли — см.
     *                 AdminUserController::store;
     * settings      — запись любого ключа system_settings, включая
     *                 маршрутизацию денег безопасной сделки. Белого списка
     *                 ключей у настроек нет;
     * monetization* — деньги площадки. Вдобавок раздел выдался бы
     *                 наполовину: выплаты открылись бы, а споры и
     *                 безопасные сделки остались бы за политиками,
     *                 которые спрашивают роль;
     * dashboard.full — та же сводка с деньгами;
     * dashboard, analytics, design, monetizationPricing и прочие вкладки —
     *                 не охраняют ни одного маршрута. Галочка выглядела бы
     *                 выданной, а страница отдавала бы 403. Проверяется
     *                 тестом: у каждого выдаваемого ключа есть охраняемый
     *                 им маршрут или явная проверка в коде;
     * rulesPages, legalPages — оба раздела принимают готовый HTML и
     *                 рисуются на публичной странице через
     *                 dangerouslySetInnerHTML. Пока это было доступно
     *                 только Владельцу, «Владелец может внедрить скрипт
     *                 себе» смысла не имело. Выдача галочкой меняет
     *                 именно это: скрипт, положенный в правила, отработает
     *                 в браузере Владельца, открывшего страницу, — и
     *                 оттуда до создания учётки Владельца один запрос.
     *                 Вернуть сюда после того, как содержимое перестанет
     *                 приниматься сырым (отдельная ветка).
     *
     * @var list<string>
     */
    private const GRANTABLE = [
        // Разделы, которые даёт роль модератора: их выдают администратору
        // направления — «этому администратору ещё и обращения».
        'users',
        'content',
        'ads',
        'delivery',
        'moderation',
        'applications',
        'feedback',
        'categories',
        'reviews',
        'notifications',
        'media',
        // Разделы Владельца без денег: наполнение сайта и справочники.
        'events',
        'feedBanners',
        'feedGuestAccess',
        'notificationPolicy',
        'landingBlocks',
        'icons',
        'reviewCategories',
        'footerLinks',
        'communities',
        'auditLog',
        'diagnostics',
        // Служебные ключи уровня модератора.
        'reports',
        'posts.delete',
        'listings.delete',
        // Точечные действия Владельца внутри чужих разделов — ради них
        // задача и затевалась: «этому модератору ещё и цены».
        'categories.prices',
        'users.fields',
    ];

    /** @return list<string> служебные ключи без пункта меню, доступные человеку */
    public static function capabilitiesFor(?User $user): array
    {
        return array_values(array_filter(
            array_keys(self::SERVICE),
            fn (string $s) => self::allows($user, $s),
        ));
    }

    public static function isStaff(?User $user): bool
    {
        return $user !== null && in_array($user->role, [UserRole::Owner, UserRole::Moderator], true);
    }

    public static function isOwner(?User $user): bool
    {
        return $user !== null && $user->role === UserRole::Owner;
    }

    /** Ступень роли в админке (см. RANK); неизвестное — ноль. */
    public static function rankOf(UserRole|string $role): int
    {
        return self::RANK[$role instanceof UserRole ? $role->value : $role] ?? 0;
    }

    /** Неизвестный ключ закрыт: опечатка в маршруте не должна открыть раздел. */
    public static function allows(?User $user, string $section): bool
    {
        $need = self::SECTIONS[$section] ?? self::SERVICE[$section] ?? null;
        if ($user === null || $need === null) {
            return false;
        }

        if ((self::RANK[$user->role->value] ?? 0) >= self::RANK[$need]) {
            return true;
        }

        return self::granted($user, $section);
    }

    /**
     * Выдано ли право отдельно, поверх роли (C3).
     *
     * Проверяется только то, что вообще можно выдать: строка в таблице с
     * невыдаваемым ключом ничего не открывает. Иначе запрет на выдачу
     * `roles` пришлось бы держать в двух местах, и достаточно было бы
     * обойти один.
     */
    public static function granted(?User $user, string $section): bool
    {
        if ($user === null || ! in_array($section, self::grantableKeys(), true)) {
            return false;
        }

        /*
         * Не сотруднику права не действуют, даже если строки в таблице
         * остались. Понижение до обычного пользователя — это снятие
         * доступа целиком, и переживший его гранта не должен открывать
         * админку человеку, которого нет в списке сотрудников.
         */
        if ($user->role === UserRole::User) {
            return false;
        }

        return in_array($section, AdminPermissionGrant::sectionsFor((int) $user->id), true);
    }

    /**
     * Что можно выдать галочкой. Состав и причины — у GRANTABLE.
     *
     * @return list<string>
     */
    public static function grantableKeys(): array
    {
        return self::GRANTABLE;
    }

    /** @return list<string> ключи, выданные человеку отдельно и что-то дающие */
    public static function grantsOf(?User $user): array
    {
        if ($user === null) {
            return [];
        }

        return array_values(array_intersect(
            AdminPermissionGrant::sectionsFor((int) $user->id),
            self::grantableKeys(),
        ));
    }

    /** @return list<string> разделы меню, доступные человеку, без служебных ключей */
    public static function sectionsFor(?User $user): array
    {
        return array_values(array_filter(
            array_keys(self::SECTIONS),
            fn (string $s) => self::allows($user, $s),
        ));
    }

    /**
     * Все ключи, которые даёт роль сама по себе, — и разделы меню, и
     * служебные.
     *
     * Матрица ролей перечисляет только разделы меню, и по ней выходило,
     * что жалоб и удаления записей у модератора нет: в списке галочек они
     * появлялись невыданными у того, у кого уже есть.
     *
     * @return list<string>
     */
    public static function keysForRole(UserRole|string $role): array
    {
        $ранг = self::rankOf($role);

        return array_values(array_filter(
            self::keys(),
            fn (string $key) => $ранг >= self::rankOf(self::SECTIONS[$key] ?? self::SERVICE[$key] ?? 'owner'),
        ));
    }

    /** @return array<string, string> раздел меню → минимальная роль */
    public static function sectionLevels(): array
    {
        return self::SECTIONS;
    }

    /** @return list<string> все ключи, которыми можно охранять маршрут */
    public static function keys(): array
    {
        return [...array_keys(self::SECTIONS), ...array_keys(self::SERVICE)];
    }

    /** Поля пользователя, которые меняет только Владелец (ключ users.fields). */
    public const OWNER_ONLY_USER_FIELDS = [
        'role',
        'email',
        'password',
        'subscription_exempt',
        'free_listings_quota',
        'free_listings_unlimited',
        'free_listings_used',
    ];

    /** Поля категории: цены размещения — деньги (ключ categories.prices). */
    public const OWNER_ONLY_CATEGORY_FIELDS = ['listing_price_cents', 'subscriber_listing_price_cents'];
}
