<?php

namespace Modules\Billing\Exceptions;

use App\Support\Plural;
use RuntimeException;

/**
 * Баллов не хватает.
 *
 * Отдельно от `InsufficientFundsException`: там рубли, и сообщение про
 * пополнение кошелька. Баллы не пополняются деньгами — их зарабатывают, —
 * и предлагать «пополнить» было бы обещанием того, чего нет.
 *
 * Сообщение называет, сколько именно не хватает: «недостаточно баллов» без
 * числа заставляет человека идти искать остаток в другом месте.
 */
class InsufficientPointsException extends RuntimeException
{
    public function __construct(string $message, public readonly int $shortBy = 0, public readonly int $balance = 0)
    {
        parent::__construct($message);
    }

    public static function shortBy(int $нехватка, int $остаток): self
    {
        $нехватка = max(0, $нехватка);

        return new self(
            'Не хватает '.$нехватка.' '.Plural::балловРодительный($нехватка).'. На счету '.$остаток.'.',
            $нехватка,
            $остаток,
        );
    }

}
