<?php

namespace Tests;

use App\Models\Payment;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
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

        // Прогон с боевым окружением — это прогон против боевых доступов:
        // SMS, банк, почта. Имя базы проверяется ниже, но база — не единственное,
        // что тесты трогают снаружи.
        if (! app()->environment('testing')) {
            $this->fail('Tests must run with APP_ENV=testing, got: '.app()->environment());
        }

        if ((string) config('sms.iqsms.login') !== '' || (string) config('sms.mts.login') !== '' || (string) config('sms.mts.token') !== '') {
            $this->fail('Tests must not see real SMS credentials (IQSMS_LOGIN / MTS_LOGIN / MTS_TOKEN). See phpunit.xml.');
        }

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

    /**
     * Выполнить проверку в поясе прода.
     *
     * Прод живёт по Europe/Moscow, тесты — по UTC, колонки времени без пояса.
     * Дата в UTC, записанная как есть, в UTC-окружении выглядит верной и
     * сдвигается на три часа только на проде — так 14.09 уехало время
     * мероприятий. Проверки дат с форм — через этот помощник.
     *
     * @template T
     *
     * @param  \Closure(): T  $callback
     * @return T
     */
    protected function inAppTimezone(string $timezone, \Closure $callback): mixed
    {
        $previousConfig = config('app.timezone');
        $previousDefault = date_default_timezone_get();
        config(['app.timezone' => $timezone]);
        date_default_timezone_set($timezone);
        // Сессия Postgres — как на проде (Etc/UTC). Локальная база живёт в
        // своём поясе, и timestamptz без смещения там записался бы «верно»
        // там, где прод ошибается.
        DB::statement("set time zone 'UTC'");

        try {
            return $callback();
        } finally {
            try {
                DB::statement('reset time zone');
            } catch (\Throwable) {
                // Транзакция теста уже прервана — её откат вернёт пояс сам.
            }
            config(['app.timezone' => $previousConfig]);
            date_default_timezone_set($previousDefault);
        }
    }

    protected function recordPaidPlanPayment(User $user, int $planId, int $amountCents = 9900): void
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
