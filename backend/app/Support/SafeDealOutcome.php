<?php

namespace App\Support;

use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;

/**
 * Чем сделка кончилась на самом деле — и сколько кому досталось.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КЛАСС. Колонки сделки `seller_payout_kopecks` и
 * `platform_fee_kopecks` — это план: сколько предполагалось выплатить и
 * удержать. При разрешении спора с разделением `splitPayout` их не
 * трогает, фактические доли пишутся в `metadata.split`. Значит по строке
 * план и факт расходятся, и каждый, кто читает сделку, обязан это знать.
 *
 * Таких читателей уже трое: письмо о статусе, сводка бухгалтерии и
 * выгрузка реестра. Первые два чинили порознь 29.09 — каждый со своим
 * разбором одного и того же. Третий чинится этим классом, и письмо
 * переведено на него же: два представления об одном исходе однажды
 * разойдутся, и разойдутся молча.
 *
 * ЧЕТЫРЕ ИСХОДА, И БОЛЬШЕ НЕТ:
 *
 *   `split`     — спор разрешён делением; доли в `metadata.split`;
 *   `refund`    — отменена или возвращена целиком; всё покупателю;
 *   `completed` — обычное завершение; план и есть факт;
 *   `open`      — ещё идёт; фактов пока никаких.
 */
final class SafeDealOutcome
{
    public const SPLIT = 'split';

    public const REFUND = 'refund';

    public const COMPLETED = 'completed';

    public const OPEN = 'open';

    /**
     * Фактические доли при разделении, или null.
     *
     * `buyer` уже включает возвращённую комиссию — так её и записывает
     * `splitPayout`, одной проводкой. Сколько из этой доли было комиссией,
     * лежит отдельно в `fee_returned`.
     *
     * @return array{buyer: int, seller: int, fee_returned: int}|null
     */
    public static function split(SafeDeal $deal): ?array
    {
        $split = $deal->metadata['split'] ?? null;

        if (! is_array($split) || ! array_key_exists('seller_kopecks', $split)) {
            return null;
        }

        return [
            'buyer' => (int) ($split['buyer_kopecks'] ?? 0),
            'seller' => (int) ($split['seller_kopecks'] ?? 0),
            'fee_returned' => (int) ($split['fee_returned_kopecks'] ?? 0),
        ];
    }

    public static function kind(SafeDeal $deal): string
    {
        if (self::split($deal) !== null) {
            return self::SPLIT;
        }

        return match (self::status($deal)) {
            SafeDealStatus::Cancelled, SafeDealStatus::Refunded => self::REFUND,
            SafeDealStatus::Completed => self::COMPLETED,
            default => self::OPEN,
        };
    }

    public static function label(SafeDeal $deal): string
    {
        return match (self::kind($deal)) {
            self::SPLIT => 'разделена в споре',
            self::REFUND => 'возврат покупателю',
            self::COMPLETED => 'завершена',
            default => 'не завершена',
        };
    }

    /**
     * Сколько на самом деле ушло продавцу.
     *
     * С 30.09 это просто колонка: `splitPayout` и `refundBuyer` пишут в
     * неё факт. Раньше здесь стоял разбор `metadata.split`, потому что
     * колонка оставалась планом — и такой же разбор жил ещё в трёх
     * местах, каждый со своей правкой.
     */
    public static function paidToSeller(SafeDeal $deal): int
    {
        return (int) $deal->seller_payout_kopecks;
    }

    /**
     * Сколько на самом деле вернулось покупателю.
     *
     * Своей колонки у этой величины нет, и заводить её незачем: при
     * разделении доля покупателя лежит в `metadata.split`, при полном
     * возврате это вся сумма удержания.
     */
    public static function returnedToBuyer(SafeDeal $deal): int
    {
        if ($доли = self::split($deal)) {
            return $доли['buyer'];
        }

        return self::kind($deal) === self::REFUND ? (int) $deal->amount_kopecks : 0;
    }

    /**
     * Сколько на самом деле осталось площадке.
     *
     * Тоже колонка: при разделении и возврате туда пишется ноль —
     * удержание раздано целиком, площадка не получает ничего.
     *
     * Условие по статусу осталось на один случай: сделка, не дошедшая до
     * конца. У неё комиссия посчитана, но не удержана — деньги ещё в
     * холде, и записывать их в доход нельзя.
     */
    public static function retainedByPlatform(SafeDeal $deal): int
    {
        return self::kind($deal) === self::COMPLETED ? (int) $deal->platform_fee_kopecks : 0;
    }

    /** Комиссию платит покупатель? У сделок до 27.09 — нет. */
    public static function feePaidByBuyer(SafeDeal $deal): bool
    {
        return ($deal->fee_payer ?? SafeDealFeePayer::Seller) === SafeDealFeePayer::Buyer;
    }

    private static function status(SafeDeal $deal): ?SafeDealStatus
    {
        return $deal->status instanceof SafeDealStatus
            ? $deal->status
            : SafeDealStatus::tryFrom((string) $deal->status);
    }
}
