<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Delivery\Services\DeliveryMarkupPolicy;
use Tests\TestCase;

/**
 * Надбавка площадки к доставке.
 *
 * Покупатель видит одну строку «Доставка» с итогом; размер надбавки виден
 * площадке — в карточке сделки и в выгрузке, — и записывается снимком в саму
 * сделку: настройку меняют, и без снимка через месяц нельзя было бы сказать,
 * с какой считалась конкретная сделка.
 */
class DeliveryMarkupTest extends TestCase
{
    use RefreshDatabase;

    private function настроить(array $values): void
    {
        foreach ($values as $key => $value) {
            SystemSetting::query()->updateOrCreate(
                ['key' => $key],
                ['value' => $value, 'group' => 'delivery'],
            );
        }
    }

    private function policy(): DeliveryMarkupPolicy
    {
        return app(DeliveryMarkupPolicy::class);
    }

    public function test_disabled_markup_changes_nothing(): void
    {
        $this->настроить([
            'delivery.markup.enabled' => ['enabled' => false],
            'delivery.markup.percent' => ['percent' => 20],
            'delivery.markup.fixed_cents' => ['fixed_cents' => 10000],
        ]);

        // Выключатель сильнее заполненных полей: иначе «выключить на время»
        // требовало бы обнулять настройку и потом вспоминать её значения.
        $this->assertSame(0, $this->policy()->markupFor(50000));
        $this->assertSame(50000, $this->policy()->applyTo(50000));
    }

    public function test_percent_and_fixed_add_up(): void
    {
        $this->настроить([
            'delivery.markup.enabled' => ['enabled' => true],
            'delivery.markup.percent' => ['percent' => 10],
            'delivery.markup.fixed_cents' => ['fixed_cents' => 5000],
        ]);

        // 500 ₽ тариф → 50 ₽ процентом + 50 ₽ суммой.
        $this->assertSame(10000, $this->policy()->markupFor(50000));
        $this->assertSame(60000, $this->policy()->applyTo(50000));
    }

    public function test_percent_rounds_to_a_kopeck(): void
    {
        $this->настроить([
            'delivery.markup.enabled' => ['enabled' => true],
            'delivery.markup.percent' => ['percent' => 7.5],
            'delivery.markup.fixed_cents' => ['fixed_cents' => 0],
        ]);

        // 333,33 ₽ → 7,5 % = 24,99975 ₽; копейки не бывают дробными.
        $this->assertSame(2500, $this->policy()->markupFor(33333));
    }

    /**
     * Самовывоз не становится платным.
     *
     * Тариф ноль — доставки нет вовсе, и фиксированная надбавка на пустом
     * месте превратила бы бесплатный самовывоз в платный.
     */
    public function test_zero_delivery_gets_no_markup(): void
    {
        $this->настроить([
            'delivery.markup.enabled' => ['enabled' => true],
            'delivery.markup.percent' => ['percent' => 10],
            'delivery.markup.fixed_cents' => ['fixed_cents' => 5000],
        ]);

        $this->assertSame(0, $this->policy()->markupFor(0));
        $this->assertSame(0, $this->policy()->applyTo(0));
    }

    public function test_defaults_are_off_so_a_deploy_changes_no_prices(): void
    {
        // Строк в базе нет вовсе — то же, что сразу после выкатки.
        SystemSetting::query()->where('key', 'like', 'delivery.markup.%')->delete();

        $this->assertSame(0, $this->policy()->markupFor(50000));
    }

    public function test_negative_settings_do_not_discount_delivery(): void
    {
        // Отрицательный процент в поле — опечатка, а не скидка: доставка не
        // должна дешеветь от того, что кто-то поставил минус.
        $this->настроить([
            'delivery.markup.enabled' => ['enabled' => true],
            'delivery.markup.percent' => ['percent' => -50],
            'delivery.markup.fixed_cents' => ['fixed_cents' => -10000],
        ]);

        $this->assertSame(0, $this->policy()->markupFor(50000));
        $this->assertSame(50000, $this->policy()->applyTo(50000));
    }
}
