<?php

namespace Modules\Billing\Services;

class EscrowFeeCalculator
{
    public function __construct(
        private readonly EscrowFeeSettings $settings,
    ) {}

    /**
     * @return array{
     *   platform_fee_cents: int,
     *   seller_payout_cents: int,
     *   total_cents: int,
     *   fee_base_cents: int,
     *   fee_mode: 'flat'|'percent'|'disabled'
     * }
     */
    public function quote(int $itemCents, int $deliveryCents = 0): array
    {
        $total = $itemCents + $deliveryCents;

        if (! $this->settings->feeEnabled()) {
            return [
                'platform_fee_cents' => 0,
                'seller_payout_cents' => $itemCents,
                'total_cents' => $total,
                'fee_base_cents' => $itemCents,
                'fee_mode' => 'disabled',
            ];
        }

        $base = $this->settings->applyToBase() === 'item_plus_delivery'
            ? $total
            : $itemCents;

        if ($base <= $this->settings->flatThresholdCents()) {
            $fee = $this->settings->flatAmountCents();
            $mode = 'flat';
        } else {
            $fee = (int) round($base * $this->settings->percent() / 100);
            $fee = max($fee, $this->settings->minCents());
            $max = $this->settings->maxCents();
            if ($max !== null) {
                $fee = min($fee, $max);
            }
            $mode = 'percent';
        }

        $fee = min($fee, max(0, $itemCents));
        $sellerPayout = max(0, $itemCents - $fee);

        return [
            'platform_fee_cents' => $fee,
            'seller_payout_cents' => $sellerPayout,
            'total_cents' => $total,
            'fee_base_cents' => $base,
            'fee_mode' => $mode,
        ];
    }
}
