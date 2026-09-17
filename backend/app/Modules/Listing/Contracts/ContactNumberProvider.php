<?php

namespace Modules\Listing\Contracts;

use App\Models\Listing;
use App\Models\User;
use Modules\Listing\Support\ContactNumber;

/**
 * Откуда берётся номер для «Позвонить продавцу» — единственная точка замены
 * при переходе на АТС с подменными номерами. См. docs/seller-phone-reveal.md.
 *
 * Сейчас привязан ProfilePhoneNumberProvider: настоящий номер из профиля.
 */
interface ContactNumberProvider
{
    /** Короткое имя для журнала раскрытий: `profile`, `pbx`, … */
    public function name(): string;

    /** Есть ли что выдать по объявлению. Без запросов к внешним системам — зовётся на каждую карточку списка. */
    public function canProvide(Listing $listing): bool;

    /** Номер, который увидит этот покупатель по этому объявлению. */
    public function numberFor(Listing $listing, User $viewer): ContactNumber;
}
