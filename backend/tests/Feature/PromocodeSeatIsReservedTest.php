<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Promocode;
use App\Models\PromocodeUsage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\PromocodeService;
use Tests\TestCase;

/**
 * Место промокода занимается при выдаче скидки, а не после оплаты.
 *
 * Что было. `findValid` проверял лимит в момент, когда человеку называют
 * цену со скидкой, а строка использования появлялась только после оплаты.
 * Между двумя моментами счётчик не рос — и на единственное оставшееся место
 * одновременно проходило сколько угодно человек. Воспроизведено 04.10.
 *
 * Решение владельца: занимать при выдаче, освобождать при отмене или
 * неуспехе, а брошенное — через тридцать минут.
 *
 * Проверки идут через службу, а не через HTTP: гонка живёт именно в ней, и
 * поднимать ради неё оплату целиком значило бы мерить заодно банк, тарифы и
 * корзину.
 */
final class PromocodeSeatIsReservedTest extends TestCase
{
    use RefreshDatabase;

    private function промокод(int $мест): Promocode
    {
        return Promocode::query()->create([
            'code' => 'STAND'.$мест,
            'type' => 'percent',
            'value' => 50,
            'max_usages' => $мест,
            'max_usages_per_user' => 1,
            'is_active' => true,
            'scope' => 'all',
        ]);
    }

    private function служба(): PromocodeService
    {
        return app(PromocodeService::class);
    }

    public function test_a_reserved_seat_closes_the_last_place_for_everyone_else(): void
    {
        $код = $this->промокод(1);
        $первый = User::factory()->create();
        $второй = User::factory()->create();

        $служба = $this->служба();

        // Первый получил скидку — место занято, оплаты ещё нет.
        $служба->findValid($код->code, $первый, 'all');
        $служба->reserveSeat($код, $первый);

        // Второй до правки проходил эту же проверку: строки использования
        // ещё нет, а значит и счётчик нулевой.
        $this->expectException(ValidationException::class);
        $служба->findValid($код->code, $второй, 'all');
    }

    public function test_the_seat_comes_back_when_the_payment_fails(): void
    {
        $код = $this->промокод(1);
        $первый = User::factory()->create();
        $второй = User::factory()->create();
        $служба = $this->служба();

        $служба->findValid($код->code, $первый, 'all');
        $служба->reserveSeat($код, $первый);
        $снято = $служба->releaseSeat($код, $первый);

        self::assertSame(1, $снято, 'бронь не снялась — дальнейшая проверка ничего не доказывает');

        $код2 = $служба->findValid($код->code, $второй, 'all');
        self::assertSame($код->id, $код2->id);
    }

    public function test_an_abandoned_seat_stops_counting_after_thirty_minutes(): void
    {
        $код = $this->промокод(1);
        $первый = User::factory()->create();
        $второй = User::factory()->create();
        $служба = $this->служба();

        $бронь = $служба->reserveSeat($код, $первый);
        $бронь->forceFill(['reserved_at' => now()->subMinutes(PromocodeService::МИНУТ_БРОНИ + 1)])->save();

        // Просроченная бронь не держит место даже до прихода сторожа.
        $служба->findValid($код->code, $второй, 'all');

        $this->artisan('promocodes:release-seats')->assertSuccessful();

        self::assertSame(
            0,
            PromocodeUsage::query()->where('status', PromocodeUsage::ЗАНЯТО)->count(),
            'сторож не снял брошенную бронь',
        );
    }

    public function test_a_fresh_seat_is_not_swept_away(): void
    {
        $код = $this->промокод(5);
        $служба = $this->служба();
        $служба->reserveSeat($код, User::factory()->create());

        $this->artisan('promocodes:release-seats')->assertSuccessful();

        self::assertSame(
            1,
            PromocodeUsage::query()->where('status', PromocodeUsage::ЗАНЯТО)->count(),
            'сторож снял свежую бронь — он забирает лишнее',
        );
    }

    public function test_payment_turns_the_reservation_into_a_usage_without_taking_a_second_seat(): void
    {
        $код = $this->промокод(1);
        $человек = User::factory()->create();
        $служба = $this->служба();

        $служба->reserveSeat($код, $человек);
        $служба->recordUsage($код, $человек);

        self::assertSame(1, PromocodeUsage::query()->count(), 'оплата завела вторую строку вместо того, чтобы закрыть бронь');
        self::assertSame(
            PromocodeUsage::ИЗРАСХОДОВАНО,
            PromocodeUsage::query()->value('status'),
        );
        self::assertNotNull(PromocodeUsage::query()->value('used_at'));
    }

    public function test_a_usage_without_a_prior_reservation_is_still_recorded(): void
    {
        $код = $this->промокод(2);
        $человек = User::factory()->create();

        $this->служба()->recordUsage($код, $человек);

        self::assertSame(1, PromocodeUsage::query()->where('status', PromocodeUsage::ИЗРАСХОДОВАНО)->count());
    }
}
