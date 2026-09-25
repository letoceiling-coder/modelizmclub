<?php

namespace App\Support;

use App\Models\Promocode;
use Illuminate\Support\Carbon;

/**
 * Состояние акции во времени и по местам (C4).
 *
 * Одно место, где решается, идёт акция или нет: до C4 состояние считалось
 * в браузере и только по сроку окончания — акция с будущим началом
 * выглядела действующей, а выбравшая все места показывалась активной до
 * последнего дня.
 *
 * Даты в базе — московское стенное время (см. CLAUDE.md про часовой пояс),
 * поэтому «сколько осталось дней» считается в поясе приложения, а не в UTC:
 * иначе последний день кончался бы на три часа раньше.
 */
final class PromoCalendar
{
    public const ОТКЛЮЧЕНА = 'disabled';

    public const ЗАПЛАНИРОВАНА = 'scheduled';

    public const ИДЁТ = 'active';

    public const МЕСТА_КОНЧИЛИСЬ = 'exhausted';

    public const ЗАВЕРШИЛАСЬ = 'expired';

    /**
     * Состояние акции. Порядок проверок — от того, что отменяет всё
     * остальное, к частному: выключенная руками акция не «идёт», сколько
     * бы дней ни оставалось, а истёкшая не «запланирована».
     */
    public static function state(Promocode $promo, int $usages): string
    {
        if (! $promo->is_active) {
            return self::ОТКЛЮЧЕНА;
        }
        if ($promo->valid_until !== null && $promo->valid_until->isPast()) {
            return self::ЗАВЕРШИЛАСЬ;
        }
        if ($promo->valid_from !== null && $promo->valid_from->isFuture()) {
            return self::ЗАПЛАНИРОВАНА;
        }
        if (self::seatsLeft($promo, $usages) === 0) {
            return self::МЕСТА_КОНЧИЛИСЬ;
        }

        return self::ИДЁТ;
    }

    /** Сколько мест осталось. null — предел не задан, мест сколько угодно. */
    public static function seatsLeft(Promocode $promo, int $usages): ?int
    {
        if ($promo->max_usages === null) {
            return null;
        }

        return max(0, (int) $promo->max_usages - $usages);
    }

    /**
     * Сколько дней осталось, считая сегодняшний.
     *
     * В последний день это 1, а не 0: «осталось 0 дней» человек прочитает
     * как «уже нельзя», хотя акция ещё идёт до конца суток. null — срок не
     * задан.
     */
    public static function daysLeft(Promocode $promo, ?Carbon $now = null): ?int
    {
        if ($promo->valid_until === null) {
            return null;
        }
        $сейчас = self::сегодня($now);
        $конец = $promo->valid_until->copy()->setTimezone(self::пояс())->startOfDay();

        // Явное приведение: `diffInDays` в Carbon 3 отдаёт float со знаком.
        // Знак нужен — на нём держится ноль у истёкшей.
        return max(0, (int) $сейчас->diffInDays($конец) + 1);
    }

    /**
     * Через сколько дней начнётся. null — уже началась или начала нет.
     *
     * «Уже началась» считается относительно переданного момента, а не
     * текущего: метод принимает `$now`, и проверка, идущая мимо него,
     * отвечала бы про сегодня, а считала про переданный день.
     */
    public static function daysUntilStart(Promocode $promo, ?Carbon $now = null): ?int
    {
        if ($promo->valid_from === null) {
            return null;
        }
        $сейчас = self::сегодня($now);
        $начало = $promo->valid_from->copy()->setTimezone(self::пояс())->startOfDay();

        if ($начало->lessThanOrEqualTo($сейчас)) {
            return null;
        }

        return (int) $сейчас->diffInDays($начало);
    }

    private static function сегодня(?Carbon $now): Carbon
    {
        return ($now ?? Carbon::now())->copy()->setTimezone(self::пояс())->startOfDay();
    }

    private static function пояс(): string
    {
        return (string) config('app.timezone');
    }
}
