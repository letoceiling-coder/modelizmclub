<?php

namespace Modules\Billing\Services;

use App\Models\SystemSetting;

/**
 * Escrow service fee settings (SystemSetting group `escrow`).
 *
 * @see docs/VTB-SAFE-DEAL-DESIGN.md §18
 */
class EscrowFeeSettings
{
    private const DEFAULTS = [
        'escrow.fee.enabled' => ['enabled' => true],
        'escrow.fee.percent' => ['percent' => 5.0],
        'escrow.fee.flat_threshold_cents' => ['threshold_cents' => 100_000],
        'escrow.fee.flat_amount_cents' => ['amount_cents' => 30_000],
        'escrow.fee.min_cents' => ['min_cents' => 30_000],
        'escrow.fee.max_cents' => ['max_cents' => null],
        'escrow.fee.apply_to' => ['base' => 'item'],
        'escrow.release.mode' => ['mode' => 'buyer_confirm'],
        'escrow.release.auto_release_days' => ['days' => 7],
        'escrow.release.seller_ship_deadline_days' => ['days' => 5],
        'escrow.dispute.window_days' => ['days' => 14],
    ];

    public function all(): array
    {
        $out = [];
        foreach (self::DEFAULTS as $key => $default) {
            $out[$key] = $this->value($key);
        }

        return $out;
    }

    public function snapshot(): array
    {
        return $this->all();
    }

    public function feeEnabled(): bool
    {
        $v = $this->value('escrow.fee.enabled');

        return (bool) ($v['enabled'] ?? true);
    }

    public function percent(): float
    {
        $v = $this->value('escrow.fee.percent');

        return (float) ($v['percent'] ?? 5.0);
    }

    public function flatThresholdCents(): int
    {
        $v = $this->value('escrow.fee.flat_threshold_cents');

        return (int) ($v['threshold_cents'] ?? 100_000);
    }

    public function flatAmountCents(): int
    {
        $v = $this->value('escrow.fee.flat_amount_cents');

        return (int) ($v['amount_cents'] ?? 30_000);
    }

    public function minCents(): int
    {
        $v = $this->value('escrow.fee.min_cents');

        return (int) ($v['min_cents'] ?? 30_000);
    }

    public function maxCents(): ?int
    {
        $v = $this->value('escrow.fee.max_cents');
        $max = $v['max_cents'] ?? null;

        return $max === null ? null : (int) $max;
    }

    /** @return 'item'|'item_plus_delivery' */
    public function applyToBase(): string
    {
        $v = $this->value('escrow.fee.apply_to');
        $base = (string) ($v['base'] ?? 'item');

        return $base === 'item_plus_delivery' ? 'item_plus_delivery' : 'item';
    }

    public function autoReleaseDays(): int
    {
        $v = $this->value('escrow.release.auto_release_days');

        return max(1, (int) ($v['days'] ?? 7));
    }

    public function sellerShipDeadlineDays(): int
    {
        $v = $this->value('escrow.release.seller_ship_deadline_days');

        return max(1, (int) ($v['days'] ?? 5));
    }

    public function disputeWindowDays(): int
    {
        $v = $this->value('escrow.dispute.window_days');

        return max(1, (int) ($v['days'] ?? 14));
    }

    public function paymentTimeoutHours(): int
    {
        return 48;
    }

    /**
     * @return array<string, mixed>
     */
    private function value(string $key): array
    {
        $default = self::DEFAULTS[$key] ?? [];
        $row = SystemSetting::query()->where('key', $key)->value('value');

        if (! is_array($row)) {
            return $default;
        }

        return array_merge($default, $row);
    }
}
