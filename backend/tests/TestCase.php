<?php

namespace Tests;

use App\Models\Payment;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    private const TEST_DATABASE = 'modelizmclub_test';

    protected function setUp(): void
    {
        parent::setUp();

        if (config('database.default') !== 'pgsql') {
            $this->fail(
                'Tests must run on PostgreSQL (DB_CONNECTION=pgsql). '
                .'Got: '.config('database.default')
            );
        }

        $database = config('database.connections.pgsql.database');
        if ($database !== self::TEST_DATABASE) {
            $this->fail(
                'Tests must use isolated database '.self::TEST_DATABASE.', got: '.$database.'. '
                .'Run deploy/scripts/setup-test-db.sh and php artisan config:clear before testing.'
            );
        }
    }

    protected function recordPaidPlanPayment(\App\Models\User $user, int $planId, int $amountCents = 9900): void
    {
        Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => $amountCents,
            'currency' => 'RUB',
            'status' => 'paid',
            'provider' => 'vtb',
            'paid_at' => now(),
            'metadata' => ['plan_id' => $planId, 'payable_type' => 'subscription'],
        ]);
    }
}
