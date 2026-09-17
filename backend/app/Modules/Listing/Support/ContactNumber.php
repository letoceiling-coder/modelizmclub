<?php

namespace Modules\Listing\Support;

use Carbon\CarbonInterface;

/**
 * Номер для звонка. `expiresAt` — для подменного номера АТС, который живёт
 * ограниченное время; у номера из профиля срока нет.
 */
final readonly class ContactNumber
{
    public function __construct(
        public string $phone,
        public ?CarbonInterface $expiresAt = null,
    ) {}
}
