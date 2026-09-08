<?php

namespace Tests\Feature;

use App\Enums\SafeDealStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Подпись «оплачена» не обещает холд там, где его нет.
 *
 * При `one_stage` деньги списываются на счёт площадки в момент оплаты —
 * удержания на карте покупателя не существует. Предавторизацию банк площадке
 * не разрешал, поэтому боевой режим именно такой. Две подписи при этом
 * говорили про холд: `SafeDealStatus::Paid->label()` и
 * `SafeDealService::lifecycleLabel()`. Это расхождение письменного обещания с
 * фактическим обращением с деньгами покупателя — правовое, а не
 * косметическое: на тексты ссылается оферта.
 */
class SafeDealHoldWordingTest extends TestCase
{
    public function test_two_stage_says_the_money_is_held_on_the_card(): void
    {
        $this->assertSame('Оплачена (в холде)', SafeDealStatus::Paid->label(true));
    }

    public function test_one_stage_says_the_money_is_with_the_platform(): void
    {
        $label = SafeDealStatus::Paid->label(false);

        $this->assertSame('Оплачена, деньги у площадки', $label);
        $this->assertStringNotContainsStringIgnoringCase('холд', $label);
    }

    public function test_unknown_mode_promises_nothing(): void
    {
        // Вызывающий не знает режима — подпись обязана молчать о том, где
        // лежат деньги, а не угадывать.
        $label = SafeDealStatus::Paid->label();

        $this->assertSame('Оплачена', $label);
        $this->assertStringNotContainsStringIgnoringCase('холд', $label);
    }

    /** @return list<array{0: SafeDealStatus}> */
    public static function otherStatuses(): array
    {
        return array_map(
            static fn (SafeDealStatus $s): array => [$s],
            array_values(array_filter(
                SafeDealStatus::cases(),
                static fn (SafeDealStatus $s): bool => $s !== SafeDealStatus::Paid,
            )),
        );
    }

    #[DataProvider('otherStatuses')]
    public function test_other_statuses_do_not_depend_on_the_capture_mode(SafeDealStatus $status): void
    {
        // Режим влияет только на «оплачена»: во всех прочих состояниях деньги
        // либо ещё не приходили, либо уже ушли, и говорить про удержание не о
        // чем.
        $this->assertSame($status->label(true), $status->label(false));
        $this->assertSame($status->label(true), $status->label());
    }
}
