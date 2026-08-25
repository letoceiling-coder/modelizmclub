<?php

namespace Tests\Unit;

use App\Support\DeliveryQuoteRounding;
use PHPUnit\Framework\TestCase;

class DeliveryQuoteRoundingTest extends TestCase
{
    public function test_rounds_up_to_50_below_500_rubles(): void
    {
        $this->assertSame(35000, DeliveryQuoteRounding::roundKopecks(35000));
        $this->assertSame(40000, DeliveryQuoteRounding::roundKopecks(35100));
        $this->assertSame(50000, DeliveryQuoteRounding::roundKopecks(45001));
    }

    public function test_rounds_up_to_100_from_500_rubles(): void
    {
        $this->assertSame(50000, DeliveryQuoteRounding::roundKopecks(50000));
        $this->assertSame(60000, DeliveryQuoteRounding::roundKopecks(50100));
        $this->assertSame(0, DeliveryQuoteRounding::roundKopecks(0));
    }
}
