<?php

namespace App\Support;

final class FeedGuestAccessRegistry
{
    public const SETTING_KEY = 'feed.guest_access';

    /** @return list<array{key: string, group: string, label: string, hint: string, default_allowed: bool}> */
    public static function actions(): array
    {
        return [
            // — Лента: фильтры —
            ['key' => 'feed.filter.all', 'group' => 'feed_filters', 'label' => 'Вкладка «Все»', 'hint' => 'Просмотр общей ленты', 'default_allowed' => true],
            ['key' => 'feed.filter.following', 'group' => 'feed_filters', 'label' => 'Вкладка «Подписки»', 'hint' => 'Фильтр по подпискам', 'default_allowed' => false],
            ['key' => 'feed.filter.categories', 'group' => 'feed_filters', 'label' => 'Вкладка «Направления»', 'hint' => 'Фильтр по направлениям', 'default_allowed' => false],
            ['key' => 'feed.filter.saved', 'group' => 'feed_filters', 'label' => 'Вкладка «Сохранённое»', 'hint' => 'Сохранённые публикации', 'default_allowed' => false],
            ['key' => 'feed.category.select', 'group' => 'feed_filters', 'label' => 'Чипы направлений', 'hint' => 'Выбор категории под фильтром', 'default_allowed' => false],

            // — Лента: контент —
            ['key' => 'feed.compose.open', 'group' => 'feed_content', 'label' => 'Создание публикации', 'hint' => '«Что у вас нового?» и кнопка «+»', 'default_allowed' => false],
            ['key' => 'feed.banner.navigate', 'group' => 'feed_content', 'label' => 'Карусель событий', 'hint' => 'Клик по баннеру / «Подробнее»', 'default_allowed' => true],
            ['key' => 'feed.post.open', 'group' => 'feed_content', 'label' => 'Открытие публикации', 'hint' => 'Переход к посту', 'default_allowed' => true],
            ['key' => 'feed.post.like', 'group' => 'feed_content', 'label' => 'Лайк', 'hint' => 'Реакция на публикацию', 'default_allowed' => false],
            ['key' => 'feed.post.comment', 'group' => 'feed_content', 'label' => 'Комментарии', 'hint' => 'Комментирование', 'default_allowed' => false],
            ['key' => 'feed.post.save', 'group' => 'feed_content', 'label' => 'Закладка', 'hint' => 'Сохранение публикации', 'default_allowed' => false],
            ['key' => 'feed.post.repost', 'group' => 'feed_content', 'label' => 'Репост', 'hint' => 'Репост публикации', 'default_allowed' => false],
            ['key' => 'feed.post.author', 'group' => 'feed_content', 'label' => 'Профиль автора', 'hint' => 'Переход в профиль из поста', 'default_allowed' => true],
            ['key' => 'feed.sponsored.click', 'group' => 'feed_content', 'label' => 'Рекламный пост', 'hint' => 'Клик по спонсорской публикации', 'default_allowed' => true],
            ['key' => 'feed.empty.action', 'group' => 'feed_content', 'label' => 'Кнопки пустого состояния', 'hint' => '«Показать все», «Найти авторов»', 'default_allowed' => true],

            // — Лента: направления —
            ['key' => 'feed.rail.all_categories', 'group' => 'feed_directions', 'label' => '«Все» в направлениях', 'hint' => 'Ссылка на каталог категорий', 'default_allowed' => false],
            ['key' => 'feed.rail.category', 'group' => 'feed_directions', 'label' => 'Направление (список)', 'hint' => 'Клик по направлению в правой колонке', 'default_allowed' => false],
            ['key' => 'feed.rail.subcategory', 'group' => 'feed_directions', 'label' => 'Подкатегория', 'hint' => 'Подкатегория в правой колонке', 'default_allowed' => false],
            ['key' => 'feed.find_people.open', 'group' => 'feed_directions', 'label' => '«Найди своих»', 'hint' => 'Мобильный блок направлений', 'default_allowed' => false],
            ['key' => 'feed.find_people.category', 'group' => 'feed_directions', 'label' => 'Направление в «Найди своих»', 'hint' => 'Категория в мобильном sheet', 'default_allowed' => false],

            // — Меню (sidebar / header) —
            ['key' => 'layout.nav.feed', 'group' => 'layout_nav', 'label' => 'Лента', 'hint' => 'Пункт меню → /feed', 'default_allowed' => true],
            ['key' => 'layout.nav.ads', 'group' => 'layout_nav', 'label' => 'Каталог объявлений', 'hint' => 'Пункт меню → /ads', 'default_allowed' => true],
            ['key' => 'layout.nav.ad_create', 'group' => 'layout_nav', 'label' => 'Разместить объявление', 'hint' => 'Пункт меню → /ads/new', 'default_allowed' => false],
            ['key' => 'layout.nav.my_ads', 'group' => 'layout_nav', 'label' => 'Мои объявления', 'hint' => 'Пункт меню → /my-ads', 'default_allowed' => false],
            ['key' => 'layout.nav.favorites', 'group' => 'layout_nav', 'label' => 'Избранное', 'hint' => 'Пункт меню / иконка в шапке', 'default_allowed' => false],
            ['key' => 'layout.nav.communities', 'group' => 'layout_nav', 'label' => 'Сообщества', 'hint' => 'Пункт меню → /communities', 'default_allowed' => false],
            ['key' => 'layout.nav.reviews', 'group' => 'layout_nav', 'label' => 'Обзоры', 'hint' => 'Пункт меню → /reviews', 'default_allowed' => true],
            ['key' => 'layout.nav.channels', 'group' => 'layout_nav', 'label' => 'Каналы', 'hint' => 'Пункт меню → /channels', 'default_allowed' => true],
            ['key' => 'layout.nav.messenger', 'group' => 'layout_nav', 'label' => 'Мессенджер', 'hint' => 'Пункт меню / иконка в шапке', 'default_allowed' => false],
            ['key' => 'layout.nav.friends', 'group' => 'layout_nav', 'label' => 'Друзья', 'hint' => 'Пункт меню → /friends', 'default_allowed' => false],
            ['key' => 'layout.nav.settings', 'group' => 'layout_nav', 'label' => 'Настройки', 'hint' => 'Пункт меню → /settings', 'default_allowed' => false],
            ['key' => 'layout.header.notifications', 'group' => 'layout_nav', 'label' => 'Уведомления', 'hint' => 'Колокольчик в шапке', 'default_allowed' => false],
            ['key' => 'layout.header.search', 'group' => 'layout_nav', 'label' => 'Поиск', 'hint' => 'Строка поиска в шапке', 'default_allowed' => true],

            // — Защита страниц (прямой URL) —
            ['key' => 'route.ads', 'group' => 'route_guard', 'label' => 'Страница /ads', 'hint' => 'Каталог объявлений', 'default_allowed' => true],
            ['key' => 'route.ads_new', 'group' => 'route_guard', 'label' => 'Страница /ads/new', 'hint' => 'Создание объявления', 'default_allowed' => false],
            ['key' => 'route.my_ads', 'group' => 'route_guard', 'label' => 'Страница /my-ads', 'hint' => 'Мои объявления', 'default_allowed' => false],
            ['key' => 'route.favorites', 'group' => 'route_guard', 'label' => 'Страница /favorites', 'hint' => 'Избранное', 'default_allowed' => false],
            ['key' => 'route.reviews', 'group' => 'route_guard', 'label' => 'Страница /reviews', 'hint' => 'Обзоры', 'default_allowed' => true],
            ['key' => 'route.channels', 'group' => 'route_guard', 'label' => 'Страница /channels', 'hint' => 'Каналы', 'default_allowed' => true],
            ['key' => 'route.messenger', 'group' => 'route_guard', 'label' => 'Страница /messenger', 'hint' => 'Мессенджер', 'default_allowed' => false],
            ['key' => 'route.friends', 'group' => 'route_guard', 'label' => 'Страница /friends', 'hint' => 'Друзья', 'default_allowed' => false],
            ['key' => 'route.communities', 'group' => 'route_guard', 'label' => 'Страница /communities', 'hint' => 'Сообщества', 'default_allowed' => false],
            ['key' => 'route.categories', 'group' => 'route_guard', 'label' => 'Страницы /categories', 'hint' => 'Каталог направлений', 'default_allowed' => false],
            ['key' => 'route.notifications', 'group' => 'route_guard', 'label' => 'Страница /notifications', 'hint' => 'Уведомления', 'default_allowed' => false],
            ['key' => 'route.settings', 'group' => 'route_guard', 'label' => 'Страница /settings', 'hint' => 'Настройки', 'default_allowed' => false],
            ['key' => 'route.profile', 'group' => 'route_guard', 'label' => 'Страница /profile', 'hint' => 'Мой профиль', 'default_allowed' => false],
            ['key' => 'route.user', 'group' => 'route_guard', 'label' => 'Страница /user/{id}', 'hint' => 'Профиль пользователя', 'default_allowed' => true],
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
        ];
    }

    /** @return array<string, mixed> */
    public static function defaultConfig(): array
    {
        $actions = [];
        foreach (self::actions() as $row) {
            $actions[$row['key']] = [
                'allowed' => $row['default_allowed'],
                'deny_mode' => 'inherit',
            ];
        }

        return [
            'version' => 1,
            'default_deny_mode' => 'popup',
            'popup' => [
                'title' => 'Нужна подписка',
                'description' => 'Войдите и оформите подписку, чтобы пользоваться этой функцией.',
                'primary_cta' => 'Оформить подписку',
                'secondary_cta' => 'Позже',
            ],
            'actions' => $actions,
        ];
    }
}
