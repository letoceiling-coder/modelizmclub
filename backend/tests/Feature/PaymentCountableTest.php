<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Payment::countable() — сумма настоящих денег без платежей через заглушку.
 */
class PaymentCountableTest extends TestCase
{
    use RefreshDatabase;

    public function test_countable_leaves_stub_payments_out_of_sums(): void
    {
        $user = User::factory()->create();
        foreach (['stub' => 9900, 'vtb' => 59900, 'yookassa' => 1000] as $provider => $cents) {
            Payment::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                'amount_cents' => $cents,
                'currency' => 'RUB',
                'status' => 'paid',
                'provider' => $provider,
                'paid_at' => now(),
            ]);
        }

        $this->assertSame(70800, (int) Payment::query()->sum('amount_cents'));
        $this->assertSame(60900, (int) Payment::query()->countable()->sum('amount_cents'));
    }

    public function test_is_test_is_true_only_for_stub(): void
    {
        $this->assertTrue((new Payment(['provider' => 'stub']))->isTest());
        $this->assertFalse((new Payment(['provider' => 'vtb']))->isTest());
        $this->assertFalse((new Payment(['provider' => null]))->isTest());
    }
}
