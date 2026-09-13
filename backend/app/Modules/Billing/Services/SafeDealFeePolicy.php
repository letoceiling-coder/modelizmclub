<?php

namespace Modules\Billing\Services;

use App\Models\SystemSetting;

/**
 * Комиссия безопасной сделки — одно место на сервер и страницу тарифов.
 *
 * До 13.09 значений было два. Страница тарифов читала `escrow.fee.*` (5 %,
 * «не менее 300 ₽»), а расчёт сделки — ключ `safe_deal.platform_fee_percent`,
 * которого в базе не было, и брал 5 % из конфига без минимума. На сделке в
 * 1 000 ₽ страница обещала 300 ₽, удерживалось 50 (приёмка 13.09, D4).
 *
 * Теперь оба читают эту политику. Настройки — `system_settings`:
 *
 *   escrow.fee.enabled    {enabled: bool}      — выключено: комиссия 0
 *   escrow.fee.percent    {percent: float}     — нет строки: config billing.safe_deal.platform_fee_percent
 *   escrow.fee.min_cents  {min_cents: int}     — нет строки: 0
 *   escrow.fee.max_cents  {max_cents: ?int}    — нет строки: без верхней границы
 *   escrow.fee.apply_to   {base: "item"}       — от цены товара, доставка не входит
 *
 * Комиссия не бывает больше цены товара: минимум на дешёвом лоте иначе
 * сделал бы выплату продавцу отрицательной.
 */
class SafeDealFeePolicy
{
    /** @return array{enabled: bool, percent: float, min_cents: int, max_cents: ?int, base: string} */
    public function settings(): array
    {
        $rows = SystemSetting::query()
            ->whereIn('key', ['escrow.fee.enabled', 'escrow.fee.percent', 'escrow.fee.min_cents', 'escrow.fee.max_cents', 'escrow.fee.apply_to'])
            ->pluck('value', 'key');

        $field = static function (string $key, string $name, mixed $default) use ($rows): mixed {
            $value = $rows[$key] ?? null;

            return is_array($value) && array_key_exists($name, $value) ? $value[$name] : $default;
        };

        $max = $field('escrow.fee.max_cents', 'max_cents', null);

        return [
            'enabled' => (bool) $field('escrow.fee.enabled', 'enabled', true),
            'percent' => max(0.0, (float) $field('escrow.fee.percent', 'percent', config('billing.safe_deal.platform_fee_percent', 5))),
            'min_cents' => max(0, (int) $field('escrow.fee.min_cents', 'min_cents', 0)),
            'max_cents' => $max === null ? null : max(0, (int) $max),
            'base' => (string) $field('escrow.fee.apply_to', 'base', 'item'),
        ];
    }

    public function percent(): float
    {
        $settings = $this->settings();

        return $settings['enabled'] ? $settings['percent'] : 0.0;
    }

    /** Комиссия в копейках от цены товара в копейках. */
    public function feeFor(int $itemKopecks): int
    {
        $settings = $this->settings();
        if (! $settings['enabled'] || $itemKopecks <= 0) {
            return 0;
        }

        $fee = (int) round($itemKopecks * $settings['percent'] / 100);
        $fee = max($fee, $settings['min_cents']);
        if ($settings['max_cents'] !== null) {
            $fee = min($fee, $settings['max_cents']);
        }

        return min($fee, $itemKopecks);
    }
}
