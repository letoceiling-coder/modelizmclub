<?php

namespace Modules\Billing\Exceptions;

use RuntimeException;

class InsufficientFundsException extends RuntimeException
{
    public function __construct(string $message = 'Недостаточно средств на балансе.')
    {
        parent::__construct($message);
    }
}
