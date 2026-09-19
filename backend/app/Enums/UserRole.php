<?php

namespace App\Enums;

/**
 * Роль человека на площадке. Права в админке — по этой колонке и карте
 * разделов `AdminAccess`, не по Spatie (снят 19.09).
 *
 * owner          — Владелец: всё, включая деньги, роли и настройки;
 * moderator      — модерация и общие разделы админки;
 * category_admin — модерация только своих направлений;
 * user           — админки нет.
 *
 * До 19.09 Владельцем считался любой `admin`, и различить их было нельзя;
 * `subscriber` как роль не выдавался никому — подписку определяет таблица
 * подписок, а не роль.
 */
enum UserRole: string
{
    case Owner = 'owner';
    case Moderator = 'moderator';
    case CategoryAdmin = 'category_admin';
    case User = 'user';
}
