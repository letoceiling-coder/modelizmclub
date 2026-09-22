<?php

namespace Tests\Unit;

use App\Support\DeliveryPointSnapshot;
use PHPUnit\Framework\TestCase;

/**
 * Снимок точки: годится он для заказа или только для расчёта цены.
 *
 * Разбор 22.09: расчёт СДЭК проходит по коду города, а заказ требует
 * пункта или адреса. Снимок «только город» непустой и выглядел готовым —
 * на этом и держались 19 незаведённых отправлений.
 */
class DeliveryPointSnapshotTest extends TestCase
{
    public function test_a_point_snapshot_is_usable_for_an_order(): void
    {
        $this->assertTrue(DeliveryPointSnapshot::hasPickupPoint([
            'city_code' => 44,
            'external_point_id' => 'MSK180',
        ]));
    }

    /** Ровно тот снимок, что лежал в source_point у всех девятнадцати. */
    public function test_a_city_only_snapshot_is_not_usable_for_an_order(): void
    {
        $город = ['city_code' => 44, 'label' => 'Москва'];

        $this->assertFalse(DeliveryPointSnapshot::hasPickupPoint($город));
        $this->assertTrue(DeliveryPointSnapshot::cityOnly($город));
    }

    /** Пустая строка — не пункт: `?? ''` пропускал её как значение. */
    public function test_an_empty_point_id_is_not_a_point(): void
    {
        $this->assertFalse(DeliveryPointSnapshot::hasPickupPoint([
            'city_code' => 44,
            'external_point_id' => '   ',
        ]));
    }

    public function test_an_address_counts_for_door_tariffs(): void
    {
        $this->assertTrue(DeliveryPointSnapshot::hasAddress([
            'city_code' => 44,
            'address' => 'Москва, ул. Тверская, 1',
        ]));
    }

    /** Адрес приезжает и вложенным — снимок пункта СДЭК кладёт его в массив. */
    public function test_a_nested_address_counts_too(): void
    {
        $this->assertTrue(DeliveryPointSnapshot::hasAddress([
            'address' => ['address' => '350090, Краснодар, ул. Репина, 5'],
        ]));
    }

    /**
     * Тариф «от двери»: пункта нет, адрес есть — конец маршрута собран.
     *
     * Адреса не передавались вовсе: ключей `from_location`/`to_location`
     * в теле заказа не было. На складских тарифах это не мешало, на
     * адресных сломалось бы тем же `is empty`.
     */
    public function test_an_address_only_snapshot_is_usable_for_door_tariffs(): void
    {
        $адрес = ['city_code' => 44, 'address' => 'Москва, ул. Тверская, 1'];

        $this->assertFalse(DeliveryPointSnapshot::hasPickupPoint($адрес));
        $this->assertTrue(DeliveryPointSnapshot::hasAddress($адрес));
        $this->assertFalse(DeliveryPointSnapshot::cityOnly($адрес), 'адрес есть — это не «только город»');
    }

    public function test_nothing_at_all_is_not_a_point(): void
    {
        $this->assertFalse(DeliveryPointSnapshot::hasPickupPoint(null));
        $this->assertFalse(DeliveryPointSnapshot::hasAddress(null));
        $this->assertFalse(DeliveryPointSnapshot::cityOnly(null));
        $this->assertFalse(DeliveryPointSnapshot::cityOnly([]));
    }
}
