<?php

namespace Modules\Delivery\Services;

use App\Models\SystemSetting;

/**
 * Надбавка площадки к стоимости доставки.
 *
 * Перевозчик возвращает свой тариф; площадка может добавить к нему сверху —
 * процент, фиксированную сумму или то и другое. Покупатель видит одну строку
 * «Доставка» с итогом: разбивка «тариф + надбавка» ему ничего не даёт, а
 * торговаться с перевозчиком он всё равно не может.
 *
 * Скрыта от покупателя, но не от площадки: размер надбавки записывается в
 * сделку (`metadata.delivery_markup_kopecks`) и виден владельцу в карточке
 * сделки. Иначе через месяц никто бы не ответил, сколько на доставке
 * заработано и с какой настройкой считалась конкретная сделка.
 *
 * Настройки — `system_settings`, группа `delivery`:
 *
 *   delivery.markup.enabled      {enabled: bool}     — выключено: надбавки нет
 *   delivery.markup.percent      {percent: float}    — процент от тарифа
 *   delivery.markup.fixed_cents  {fixed_cents: int}  — сумма в копейках
 *
 * Процент и сумма складываются, а не исключают друг друга: обычная
 * надбавка — «процент плюс фиксированная», и выбор «или-или» пришлось бы
 * обходить, заводя вторую настройку. Ноль в обоих полях равносилен
 * выключенной надбавке.
 */
class DeliveryMarkupPolicy
{
    private const KEYS = [
        'delivery.markup.enabled',
        'delivery.markup.percent',
        'delivery.markup.fixed_cents',
    ];

    /** @return array{enabled: bool, percent: float, fixed_cents: int} */
    public function settings(): array
    {
        $rows = SystemSetting::query()->whereIn('key', self::KEYS)->pluck('value', 'key');

        $field = static function (string $key, string $name, mixed $default) use ($rows): mixed {
            $value = $rows[$key] ?? null;

            return is_array($value) && array_key_exists($name, $value) ? $value[$name] : $default;
        };

        return [
            'enabled' => (bool) $field('delivery.markup.enabled', 'enabled', false),
            'percent' => max(0.0, (float) $field('delivery.markup.percent', 'percent', 0)),
            'fixed_cents' => max(0, (int) $field('delivery.markup.fixed_cents', 'fixed_cents', 0)),
        ];
    }

    /**
     * Надбавка в копейках к тарифу перевозчика.
     *
     * Нулевой или отрицательный тариф надбавки не получает: доставки нет —
     * добавлять не к чему, а фиксированная сумма на пустом месте превратила
     * бы самовывоз в платный.
     */
    public function markupFor(int $deliveryKopecks): int
    {
        if ($deliveryKopecks <= 0) {
            return 0;
        }

        $settings = $this->settings();
        if (! $settings['enabled']) {
            return 0;
        }

        $percent = (int) round($deliveryKopecks * $settings['percent'] / 100);

        return max(0, $percent + $settings['fixed_cents']);
    }

    /** Тариф перевозчика вместе с надбавкой — то, что платит покупатель. */
    public function applyTo(int $deliveryKopecks): int
    {
        return $deliveryKopecks + $this->markupFor($deliveryKopecks);
    }
}
