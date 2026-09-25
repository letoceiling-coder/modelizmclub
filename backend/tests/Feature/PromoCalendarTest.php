<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\PromocodeUsage;
use App\Models\User;
use App\Support\PromoCalendar;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\PromocodeService;
use Tests\TestCase;

/**
 * Календарь акций (C4): период, места, запуск с будущей даты.
 *
 * Состояние считает сервер. До этого статус выводился в браузере по одному
 * сроку окончания, и акция с будущим началом выглядела идущей.
 */
class PromoCalendarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Иначе «+3 дня» считается в одну секунду, а остаток — в другую, и
        // прогон, начавшийся в 23:59:59, даёт на день меньше.
        Carbon::setTestNow(Carbon::parse('2026-10-05 12:00:00', 'Europe/Moscow'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function акция(array $поля = []): Promocode
    {
        return Promocode::query()->create(array_merge([
            'code' => 'TEST'.random_int(1000, 9999),
            'type' => 'percent',
            'scope' => 'listing_placement',
            'value' => 20,
            'is_active' => true,
        ], $поля));
    }

    private function погасить(Promocode $promo, int $сколько): void
    {
        for ($i = 0; $i < $сколько; $i++) {
            $человек = User::factory()->create(['status' => UserStatus::Active]);
            PromocodeUsage::query()->create([
                'promocode_id' => $promo->id,
                'user_id' => $человек->id,
                'used_at' => now(),
            ]);
        }
    }

    public function test_акция_с_будущим_началом_запланирована_а_не_идёт(): void
    {
        $promo = $this->акция([
            'valid_from' => now()->addDays(3)->toDateString(),
            'valid_until' => now()->addDays(10)->toDateString(),
        ]);

        $this->assertSame(PromoCalendar::ЗАПЛАНИРОВАНА, PromoCalendar::state($promo->fresh(), 0));
        $this->assertSame(3, PromoCalendar::daysUntilStart($promo->fresh()));
    }

    public function test_начавшаяся_акция_идёт(): void
    {
        $promo = $this->акция([
            'valid_from' => now()->subDay()->toDateString(),
            'valid_until' => now()->addDays(5)->toDateString(),
        ]);

        $this->assertSame(PromoCalendar::ИДЁТ, PromoCalendar::state($promo->fresh(), 0));
        $this->assertNull(PromoCalendar::daysUntilStart($promo->fresh()));
    }

    public function test_в_последний_день_остаётся_один_день_а_не_ноль(): void
    {
        // Ноль человек прочитает как «уже нельзя», а акция идёт до конца суток.
        $promo = $this->акция(['valid_until' => now()->toDateString()]);

        $this->assertSame(1, PromoCalendar::daysLeft($promo->fresh()));
        $this->assertSame(PromoCalendar::ИДЁТ, PromoCalendar::state($promo->fresh(), 0));
    }

    public function test_истёкшая_акция_завершилась(): void
    {
        $promo = $this->акция(['valid_until' => now()->subDay()->toDateString()]);

        $this->assertSame(PromoCalendar::ЗАВЕРШИЛАСЬ, PromoCalendar::state($promo->fresh(), 0));
        $this->assertSame(0, PromoCalendar::daysLeft($promo->fresh()));
    }

    public function test_места_считаются_и_кончаются(): void
    {
        $promo = $this->акция(['max_usages' => 3, 'valid_until' => now()->addDays(30)->toDateString()]);

        $this->assertSame(3, PromoCalendar::seatsLeft($promo->fresh(), 0));
        $this->assertSame(1, PromoCalendar::seatsLeft($promo->fresh(), 2));
        $this->assertSame(PromoCalendar::ИДЁТ, PromoCalendar::state($promo->fresh(), 2));

        $this->assertSame(0, PromoCalendar::seatsLeft($promo->fresh(), 3));
        $this->assertSame(PromoCalendar::МЕСТА_КОНЧИЛИСЬ, PromoCalendar::state($promo->fresh(), 3));
    }

    public function test_без_предела_мест_остаток_неизвестен(): void
    {
        $promo = $this->акция(['max_usages' => null]);

        $this->assertNull(PromoCalendar::seatsLeft($promo->fresh(), 100));
        $this->assertSame(PromoCalendar::ИДЁТ, PromoCalendar::state($promo->fresh(), 100));
    }

    public function test_выключенная_руками_не_идёт_сколько_бы_ни_осталось(): void
    {
        $promo = $this->акция([
            'is_active' => false,
            'valid_until' => now()->addDays(30)->toDateString(),
        ]);

        $this->assertSame(PromoCalendar::ОТКЛЮЧЕНА, PromoCalendar::state($promo->fresh(), 0));
    }

    /**
     * Дни считаются в московском поясе, а не в UTC.
     *
     * Сервер живёт в UTC, срок в базе — московское стенное время. Поздним
     * вечером по Москве это разные сутки, и в UTC последний день кончался
     * бы на три часа раньше.
     */
    public function test_остаток_дней_считается_по_московскому_дню(): void
    {
        /*
         * Момент выбран там, где пояса расходятся: 01:00 по Москве
         * 1 октября — это ещё 22:00 UTC 30 сентября. По московскому счёту
         * идёт последний день акции и остаётся 1; по UTC вышло бы 2.
         *
         * Через `inAppTimezone`, потому что обычный прогон идёт в UTC
         * (APP_TIMEZONE в .env.testing не задан), и без обёртки тест
         * остался бы зелёным даже с расчётом в UTC — то есть проверял бы
         * не то, что называет.
         */
        $this->inAppTimezone('Europe/Moscow', function (): void {
            $promo = $this->акция(['valid_until' => '2026-10-01']);
            $ночь = Carbon::parse('2026-10-01 01:00:00', 'Europe/Moscow');

            $this->assertSame(1, PromoCalendar::daysLeft($promo->fresh(), $ночь));
        });
    }

    public function test_день_до_запуска_считается_по_московскому_дню(): void
    {
        $this->inAppTimezone('Europe/Moscow', function (): void {
            $promo = $this->акция(['valid_from' => '2026-10-02']);
            $ночь = Carbon::parse('2026-10-01 01:00:00', 'Europe/Moscow');

            $this->assertSame(1, PromoCalendar::daysUntilStart($promo->fresh(), $ночь));
        });
    }

    /** Акция на один день — обычное дело, и создаваться она должна. */
    public function test_акция_на_один_день_создаётся(): void
    {
        $owner = User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($owner)->postJson('/api/v1/admin/promocodes', [
            'code' => 'ONEDAY',
            'type' => 'percent',
            'scope' => 'listing_placement',
            'value' => 30,
            'max_usages' => 10,
            'valid_from' => '2026-11-05',
            'valid_until' => '2026-11-05',
            'is_active' => true,
        ])->assertCreated();

        $promo = Promocode::query()->where('code', 'ONEDAY')->firstOrFail();
        $this->assertSame(1, PromoCalendar::daysLeft($promo, Carbon::parse('2026-11-05 10:00:00', 'Europe/Moscow')));
    }

    /** Без срока окончания остаток дней неизвестен, а не ноль. */
    public function test_без_срока_остаток_дней_неизвестен(): void
    {
        $owner = User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        $this->акция(['code' => 'FOREVER', 'valid_until' => null]);

        $ответ = $this->actingAs($owner)->getJson('/api/v1/admin/promocodes');
        $строка = collect($ответ->json('data.data'))->firstWhere('code', 'FOREVER');

        $this->assertNull($строка['days_left']);
        $this->assertSame(PromoCalendar::ИДЁТ, $строка['state']);
    }

    /** Выключенная руками акция попадает в ответ именно как отключённая. */
    public function test_админка_отдаёт_отключённую_как_отключённую(): void
    {
        $owner = User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        $this->акция(['code' => 'OFF', 'is_active' => false, 'valid_until' => now()->addDays(5)->toDateString()]);

        $ответ = $this->actingAs($owner)->getJson('/api/v1/admin/promocodes');
        $строка = collect($ответ->json('data.data'))->firstWhere('code', 'OFF');

        $this->assertSame(PromoCalendar::ОТКЛЮЧЕНА, $строка['state']);
    }

    /**
     * «Места кончились» в админке и отказ при погашении — про одно и то же.
     * Иначе экран говорил бы одно, а покупатель видел другое.
     */
    public function test_места_кончились_согласовано_с_отказом_при_погашении(): void
    {
        $promo = $this->акция(['max_usages' => 1, 'valid_until' => now()->addDays(5)->toDateString()]);
        $this->погасить($promo, 1);

        $this->assertSame(PromoCalendar::МЕСТА_КОНЧИЛИСЬ, PromoCalendar::state($promo->fresh(), 1));

        $ещёОдин = User::factory()->create(['status' => UserStatus::Active]);
        $this->expectException(ValidationException::class);
        app(PromocodeService::class)
            ->findValid($promo->code, $ещёОдин, 'listing_placement');
    }

    public function test_админка_отдаёт_состояние_и_остатки(): void
    {
        $owner = User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        $promo = $this->акция([
            'code' => 'CALENDAR',
            'max_usages' => 5,
            'valid_from' => now()->addDays(2)->toDateString(),
            'valid_until' => now()->addDays(9)->toDateString(),
        ]);
        $this->погасить($promo, 2);

        $ответ = $this->actingAs($owner)->getJson('/api/v1/admin/promocodes');
        $ответ->assertOk();

        $строка = collect($ответ->json('data.data'))->firstWhere('code', 'CALENDAR');
        $this->assertSame(PromoCalendar::ЗАПЛАНИРОВАНА, $строка['state']);
        $this->assertSame(2, $строка['usages_count']);
        $this->assertSame(3, $строка['seats_left']);
        $this->assertSame(10, $строка['days_left']);
        $this->assertSame(2, $строка['days_until_start']);
    }
}
