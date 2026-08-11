<?php

namespace Tests\Unit;

use Modules\Billing\Services\EscrowFeeCalculator;
use Modules\Billing\Services\EscrowFeeSettings;
use Tests\TestCase;

class EscrowFeeCalculatorTest extends TestCase
{
    public function test_flat_fee_below_threshold(): void
    {
        $settings = $this->createMock(EscrowFeeSettings::class);
        $settings->method('feeEnabled')->willReturn(true);
        $settings->method('applyToBase')->willReturn('item');
        $settings->method('flatThresholdCents')->willReturn(100_000);
        $settings->method('flatAmountCents')->willReturn(30_000);
        $settings->method('percent')->willReturn(5.0);
        $settings->method('minCents')->willReturn(30_000);
        $settings->method('maxCents')->willReturn(null);

        $calc = new EscrowFeeCalculator($settings);
        $quote = $calc->quote(50_000, 0);

        $this->assertSame(30_000, $quote['platform_fee_cents']);
        $this->assertSame(20_000, $quote['seller_payout_cents']);
        $this->assertSame('flat', $quote['fee_mode']);
    }

    public function test_percent_fee_above_threshold(): void
    {
        $settings = $this->createMock(EscrowFeeSettings::class);
        $settings->method('feeEnabled')->willReturn(true);
        $settings->method('applyToBase')->willReturn('item');
        $settings->method('flatThresholdCents')->willReturn(100_000);
        $settings->method('flatAmountCents')->willReturn(30_000);
        $settings->method('percent')->willReturn(5.0);
        $settings->method('minCents')->willReturn(30_000);
        $settings->method('maxCents')->willReturn(null);

        $calc = new EscrowFeeCalculator($settings);
        $quote = $calc->quote(1_000_000, 0);

        $this->assertSame(50_000, $quote['platform_fee_cents']);
        $this->assertSame(950_000, $quote['seller_payout_cents']);
        $this->assertSame('percent', $quote['fee_mode']);
    }

    public function test_percent_respects_minimum(): void
    {
        $settings = $this->createMock(EscrowFeeSettings::class);
        $settings->method('feeEnabled')->willReturn(true);
        $settings->method('applyToBase')->willReturn('item');
        $settings->method('flatThresholdCents')->willReturn(100_000);
        $settings->method('flatAmountCents')->willReturn(30_000);
        $settings->method('percent')->willReturn(5.0);
        $settings->method('minCents')->willReturn(30_000);
        $settings->method('maxCents')->willReturn(null);

        $calc = new EscrowFeeCalculator($settings);
        $quote = $calc->quote(150_000, 0);

        $this->assertSame(30_000, $quote['platform_fee_cents']);
        $this->assertSame('percent', $quote['fee_mode']);
    }
}
