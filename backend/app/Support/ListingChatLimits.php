<?php

namespace App\Support;

use App\Models\Message;
use App\Models\SystemSetting;
use App\Models\User;

/**
 * Сколько новых переписок по объявлениям можно начать за сутки.
 *
 * Пункт 7 решения Ж3 от 09.10: «Защита от рассылок: ограничение числа новых
 * переписок по объявлениям в сутки на одного пользователя — значение из
 * настроек, по умолчанию 20».
 *
 * Ограничение появилось вместе с самим правом писать продавцу без дружбы.
 * До него дружба работала и как защита от рассылок: чтобы написать
 * незнакомому, надо было получить его согласие. Сняв это условие, защиту
 * нужно вернуть чем-то другим — иначе одна учётка за вечер обойдёт весь
 * каталог.
 *
 * **Считается не по календарным суткам, а по последним 24 часам.** Граница
 * календарного дня означала бы, что в 23:59 предел обнуляется, и рассылку
 * можно сделать вдвое крупнее, разделив на два «дня». Плюс календарная
 * граница зависит от часового пояса, а он в этом проекте уже один раз
 * обманул расчёт (см. CLAUDE.md про возраст строки в SQL).
 *
 * **Считается по вступительным сообщениям.** Каждая новая переписка по
 * объявлению начинается с сообщения типа `listing` от покупателя — его
 * ставит `ChatService::ensureListingIntroMessage`, и ставит один раз на пару
 * «переписка + объявление». То есть такие сообщения и есть список начатых
 * переписок по объявлениям, и отдельного счётчика заводить не нужно.
 *
 * Ноль означает «без ограничения»: так настройку можно отключить, не правя
 * код. Отрицательное приводится к нулю.
 */
final class ListingChatLimits
{
    public const SETTING_KEY = 'listing_chat_limits';

    public const GROUP = 'moderation';

    public const DEFAULT_PER_DAY = 20;

    public static function newChatsPerDay(): int
    {
        $raw = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $value = is_array($raw) ? ($raw['new_chats_per_day'] ?? null) : null;

        if ($value === null || $value === '') {
            return self::DEFAULT_PER_DAY;
        }

        return max(0, (int) $value);
    }

    /** Сколько новых переписок по объявлениям человек начал за последние сутки. */
    public static function startedInLastDay(User $user): int
    {
        return Message::query()
            ->where('user_id', $user->id)
            ->where('type', 'listing')
            ->where('created_at', '>=', now()->subDay())
            ->count();
    }

    /** Предел взят. */
    public static function isExhausted(User $user): bool
    {
        $limit = self::newChatsPerDay();

        return $limit > 0 && self::startedInLastDay($user) >= $limit;
    }
}
