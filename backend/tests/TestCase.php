<?php

namespace Tests;

use App\Models\Payment;
use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    /**
     * Имя тестовой базы начинается с этого, а не равно ему.
     *
     * Жёсткое равенство означало одну базу на все рабочие деревья: два
     * прогона роняли друг другу схему, и выглядело это не как гонка, а как
     * поломка кода — `relation "migrations" does not exist`, `relation
     * "users" already exists`, `duplicate key value violates unique
     * constraint "pg_type_typname_nsp_index"`. Последнее — верный признак
     * двух одновременных `migrate:fresh`.
     *
     * Префикс оставляет защиту на месте: боевая база называется
     * `modelizmclub` и под него не подходит. А `modelizmclub_test_<дерево>`
     * подходит, и деревья перестают мешать друг другу.
     */
    private const TEST_DATABASE_PREFIX = 'modelizmclub_test';

    protected function setUp(): void
    {
        parent::setUp();

        if (config('database.default') !== 'pgsql') {
            $this->fail(
                'Tests must run on PostgreSQL (DB_CONNECTION=pgsql). '
                .'Got: '.config('database.default')
            );
        }

        $database = (string) config('database.connections.pgsql.database');
        if (! str_starts_with($database, self::TEST_DATABASE_PREFIX)) {
            $this->fail(
                'Tests must use an isolated database named '.self::TEST_DATABASE_PREFIX.'*, got: '.$database.'. '
                .'Run deploy/scripts/setup-test-db.sh and php artisan config:clear before testing.'
            );
        }

        if (Schema::hasTable('system_settings')) {
            SystemSetting::query()->firstOrCreate(
                ['key' => 'feature.communities_enabled'],
                ['value' => ['enabled' => true], 'group' => 'features'],
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
