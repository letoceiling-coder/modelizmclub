<?php

namespace Modules\Delivery\Exceptions;

use RuntimeException;

class CdekApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 0,
        public readonly ?array $response = null,
    ) {
        parent::__construct($message, $status);
    }
}
