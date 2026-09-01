<?php

namespace App\Support;

final class FeedGuestAccessRegistry
{
    public const SETTING_KEY = 'feed.guest_access';

    /** @var list<string> */
    public const TIERS = ['guest', 'auth', 'subscription'];

    /**
     * @return list<array{key: string, group: string, label: string, hint: string, default_allowed: bool, default_min_tier: string}>
     */
    public static function actions(): array
    {
        $rows = [
            // — Лента: фильтры —
            ['key' => 'feed.filter.all', 'group' => 'feed_filters', 'label' => 'Вкладка «Все»', 'hint' => 'Просмотр общей ленты', 'default_min_tier' => 'guest'],
            ['key' => 'feed.filter.following', 'group' => 'feed_filters', 'label' => 'Вкладка «Подписки»', 'hint' => 'Фильтр по подпискам', 'default_min_tier' => 'auth'],
            ['key' => 'feed.filter.categories', 'group' => 'feed_filters', 'label' => 'Вкладка «Направления»', 'hint' => 'Фильтр по направлениям', 'default_min_tier' => 'auth'],
            ['key' => 'feed.filter.saved', 'group' => 'feed_filters', 'label' => 'Вкладка «Сохранённое»', 'hint' => 'Сохранённые публикации', 'default_min_tier' => 'auth'],
            ['key' => 'feed.filter.scheduled', 'group' => 'feed_filters', 'label' => 'Вкладка «Запланированные»', 'hint' => 'Отложенные публикации автора', 'default_min_tier' => 'auth'],
            ['key' => 'feed.category.select', 'group' => 'feed_filters', 'label' => 'Чипы направлений', 'hint' => 'Выбор категории под фильтром', 'default_min_tier' => 'auth'],

            // — Лента: контент —
            ['key' => 'feed.compose.open', 'group' => 'feed_content', 'label' => 'Создание публикации', 'hint' => '«Что у вас нового?» и кнопка «+»', 'default_min_tier' => 'subscription'],
            ['key' => 'feed.banner.navigate', 'group' => 'feed_content', 'label' => 'Карусель событий', 'hint' => 'Клик по баннеру / «Подробнее»', 'default_min_tier' => 'guest'],
            ['key' => 'feed.post.open', 'group' => 'feed_content', 'label' => 'Открытие публикации', 'hint' => 'Переход к посту', 'default_min_tier' => 'guest'],
            ['key' => 'feed.post.like', 'group' => 'feed_content', 'label' => 'Лайк', 'hint' => 'Реакция на публикацию', 'default_min_tier' => 'subscription'],
            ['key' => 'feed.post.comment', 'group' => 'feed_content', 'label' => 'Комментарии', 'hint' => 'Комментирование', 'default_min_tier' => 'subscription'],
            ['key' => 'feed.post.save', 'group' => 'feed_content', 'label' => 'Закладка', 'hint' => 'Сохранение публикации', 'default_min_tier' => 'auth'],
            ['key' => 'feed.post.repost', 'group' => 'feed_content', 'label' => 'Репост', 'hint' => 'Репост публикации', 'default_min_tier' => 'subscription'],
            ['key' => 'feed.post.author', 'group' => 'feed_content', 'label' => 'Профиль автора', 'hint' => 'Переход в профиль из поста', 'default_min_tier' => 'auth'],
            ['key' => 'feed.sponsored.click', 'group' => 'feed_content', 'label' => 'Рекламный пост', 'hint' => 'Клик по спонсорской публикации', 'default_min_tier' => 'guest'],
            ['key' => 'feed.empty.action', 'group' => 'feed_content', 'label' => 'Кнопки пустого состояния', 'hint' => '«Показать все», «Найти авторов»', 'default_min_tier' => 'guest'],

            // — Лента: направления —
            ['key' => 'feed.rail.all_categories', 'group' => 'feed_directions', 'label' => '«Все» в направлениях', 'hint' => 'Ссылка на каталог категорий', 'default_min_tier' => 'auth'],
            ['key' => 'feed.rail.category', 'group' => 'feed_directions', 'label' => 'Направление (список)', 'hint' => 'Клик по направлению в правой колонке', 'default_min_tier' => 'auth'],
            ['key' => 'feed.rail.subcategory', 'group' => 'feed_directions', 'label' => 'Подкатегория', 'hint' => 'Подкатегория в правой колонке', 'default_min_tier' => 'auth'],
            ['key' => 'feed.find_people.open', 'group' => 'feed_directions', 'label' => '«Найди своих»', 'hint' => 'Мобильный блок направлений', 'default_min_tier' => 'auth'],
            ['key' => 'feed.find_people.category', 'group' => 'feed_directions', 'label' => 'Направление в «Найди своих»', 'hint' => 'Категория в мобильном sheet', 'default_min_tier' => 'auth'],

            // — Меню (sidebar / header) —
            ['key' => 'layout.nav.feed', 'group' => 'layout_nav', 'label' => 'Лента', 'hint' => 'Пункт меню → /feed', 'default_min_tier' => 'guest'],
            ['key' => 'layout.nav.ads', 'group' => 'layout_nav', 'label' => 'Каталог объявлений', 'hint' => 'Пункт меню → /ads', 'default_min_tier' => 'guest'],
            ['key' => 'layout.nav.ad_create', 'group' => 'layout_nav', 'label' => 'Разместить объявление', 'hint' => 'Пункт меню → /ads/new', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.my_ads', 'group' => 'layout_nav', 'label' => 'Мои объявления', 'hint' => 'Пункт меню → /my-ads', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.deals', 'group' => 'layout_nav', 'label' => 'Безопасные сделки', 'hint' => 'Пункт меню → /deals', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.favorites', 'group' => 'layout_nav', 'label' => 'Избранное', 'hint' => 'Пункт меню / иконка в шапке', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.communities', 'group' => 'layout_nav', 'label' => 'Сообщества', 'hint' => 'Пункт меню → /communities', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.reviews', 'group' => 'layout_nav', 'label' => 'Обзоры', 'hint' => 'Пункт меню → /reviews', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.channels', 'group' => 'layout_nav', 'label' => 'Каналы', 'hint' => 'Пункт меню → /channels', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.messenger', 'group' => 'layout_nav', 'label' => 'Мессенджер', 'hint' => 'Пункт меню / иконка в шапке', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.friends', 'group' => 'layout_nav', 'label' => 'Друзья', 'hint' => 'Пункт меню → /friends', 'default_min_tier' => 'auth'],
            ['key' => 'layout.nav.settings', 'group' => 'layout_nav', 'label' => 'Настройки', 'hint' => 'Пункт меню → /settings', 'default_min_tier' => 'auth'],
            ['key' => 'layout.header.notifications', 'group' => 'layout_nav', 'label' => 'Уведомления', 'hint' => 'Колокольчик в шапке', 'default_min_tier' => 'auth'],
            ['key' => 'layout.header.search', 'group' => 'layout_nav', 'label' => 'Поиск', 'hint' => 'Строка поиска в шапке', 'default_min_tier' => 'auth'],

            // — Защита страниц (прямой URL) —
            ['key' => 'route.feed', 'group' => 'route_guard', 'label' => 'Страница /feed', 'hint' => 'Лента', 'default_min_tier' => 'guest'],
            ['key' => 'route.ads', 'group' => 'route_guard', 'label' => 'Страница /ads', 'hint' => 'Каталог объявлений', 'default_min_tier' => 'guest'],
            ['key' => 'route.ads_new', 'group' => 'route_guard', 'label' => 'Страница /ads/new', 'hint' => 'Создание объявления', 'default_min_tier' => 'auth'],
            ['key' => 'route.my_ads', 'group' => 'route_guard', 'label' => 'Страница /my-ads', 'hint' => 'Мои объявления', 'default_min_tier' => 'auth'],
            ['key' => 'route.deals', 'group' => 'route_guard', 'label' => 'Страница /deals', 'hint' => 'Безопасные сделки', 'default_min_tier' => 'auth'],
            ['key' => 'route.favorites', 'group' => 'route_guard', 'label' => 'Страница /favorites', 'hint' => 'Избранное', 'default_min_tier' => 'auth'],
            ['key' => 'route.reviews', 'group' => 'route_guard', 'label' => 'Страница /reviews', 'hint' => 'Обзоры', 'default_min_tier' => 'auth'],
            ['key' => 'route.channels', 'group' => 'route_guard', 'label' => 'Страница /channels', 'hint' => 'Каналы', 'default_min_tier' => 'auth'],
            ['key' => 'route.messenger', 'group' => 'route_guard', 'label' => 'Страница /messenger', 'hint' => 'Мессенджер', 'default_min_tier' => 'auth'],
            ['key' => 'route.friends', 'group' => 'route_guard', 'label' => 'Страница /friends', 'hint' => 'Друзья', 'default_min_tier' => 'auth'],
            ['key' => 'route.communities', 'group' => 'route_guard', 'label' => 'Страница /communities', 'hint' => 'Сообщества', 'default_min_tier' => 'auth'],
            ['key' => 'route.categories', 'group' => 'route_guard', 'label' => 'Страницы /categories', 'hint' => 'Каталог направлений', 'default_min_tier' => 'auth'],
            ['key' => 'route.notifications', 'group' => 'route_guard', 'label' => 'Страница /notifications', 'hint' => 'Уведомления', 'default_min_tier' => 'auth'],
            ['key' => 'route.settings', 'group' => 'route_guard', 'label' => 'Страница /settings', 'hint' => 'Настройки', 'default_min_tier' => 'auth'],
            ['key' => 'route.profile', 'group' => 'route_guard', 'label' => 'Страница /profile', 'hint' => 'Мой профиль', 'default_min_tier' => 'auth'],
            ['key' => 'route.user', 'group' => 'route_guard', 'label' => 'Страница /user/{id}', 'hint' => 'Профиль пользователя', 'default_min_tier' => 'guest'],

            // — Объявления и сделки —
            ['key' => 'ads.write_seller', 'group' => 'marketplace', 'label' => 'Написать продавцу', 'hint' => 'Диалог с продавцом из объявления', 'default_min_tier' => 'auth'],
            ['key' => 'ads.seller.profile', 'group' => 'marketplace', 'label' => 'Профиль продавца', 'hint' => 'Переход в профиль продавца из объявления', 'default_min_tier' => 'auth'],
            ['key' => 'ads.call_seller', 'group' => 'marketplace', 'label' => 'Показать телефон продавца', 'hint' => 'Раскрытие контакта в объявлении', 'default_min_tier' => 'auth'],
            ['key' => 'ads.safe_deal', 'group' => 'marketplace', 'label' => 'Безопасная сделка', 'hint' => 'Открытие сделки из объявления', 'default_min_tier' => 'auth'],
            ['key' => 'messenger.send', 'group' => 'marketplace', 'label' => 'Отправка сообщений', 'hint' => 'Текст, голос и вложения в мессенджере', 'default_min_tier' => 'auth'],
        ];

        return array_map(static function (array $row): array {
            $row['default_allowed'] = ($row['default_min_tier'] ?? 'auth') === 'guest';

            return $row;
        }, $rows);
    }

    public static function normalizeTier(mixed $tier, string $fallback = 'auth'): string
    {
        $value = is_string($tier) ? $tier : '';

        return in_array($value, self::TIERS, true) ? $value : $fallback;
    }

    /** Map legacy `allowed` boolean onto a min_tier. */
    public static function inferTierFromLegacy(bool $allowed, string $defaultMinTier): string
    {
        if ($allowed) {
            return 'guest';
        }

        $fallback = self::normalizeTier($defaultMinTier, 'auth');

        return $fallback === 'guest' ? 'auth' : $fallback;
    }

    /**
     * @param  array<string, mixed>  $patch
     * @return array{allowed: bool, deny_mode: string, min_tier: string}
     */
    public static function normalizeAction(array $patch, string $defaultMinTier, string $defaultDenyMode = 'inherit'): array
    {
        $defaultMinTier = self::normalizeTier($defaultMinTier, 'auth');
        if (array_key_exists('min_tier', $patch)) {
            $minTier = self::normalizeTier($patch['min_tier'], $defaultMinTier);
        } elseif (array_key_exists('allowed', $patch)) {
            $minTier = self::inferTierFromLegacy((bool) $patch['allowed'], $defaultMinTier);
        } else {
            $minTier = $defaultMinTier;
        }

        $denyMode = $patch['deny_mode'] ?? $defaultDenyMode;
        if (! in_array($denyMode, ['inherit', 'popup', 'redirect'], true)) {
            $denyMode = 'inherit';
        }

        return [
            'min_tier' => $minTier,
            'allowed' => $minTier === 'guest',
            'deny_mode' => $denyMode,
        ];
    }

    /** @return array<string, string> */
    public static function groupLabels(): array
    {
        return [
            'feed_filters' => 'Лента — фильтры',
            'feed_content' => 'Лента — контент',
            'feed_directions' => 'Лента — направления',
            'layout_nav' => 'Меню и шапка',
            'route_guard' => 'Защита страниц',
            'marketplace' => 'Объявления и сделки',
        ];
    }

    /** @return array<string, mixed> */
    public static function defaultConfig(): array
    {
        $actions = [];
        foreach (self::actions() as $row) {
            $actions[$row['key']] = [
                'min_tier' => $row['default_min_tier'],
                'allowed' => $row['default_min_tier'] === 'guest',
                'deny_mode' => 'inherit',
            ];
        }

        return [
            'version' => 2,
            'default_deny_mode' => 'popup',
            'popup' => [
                'title' => 'Войдите в аккаунт',
                'description' => 'Чтобы пользоваться этой функцией, войдите или зарегистрируйтесь.',
                'primary_cta' => 'Войти',
                'secondary_cta' => 'Позже',
            ],
            'actions' => $actions,
        ];
    }
}
