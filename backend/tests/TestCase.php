<?php

namespace Tests;

use App\Models\Payment;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\FeedGuestAccessRegistry;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

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

    /**
     * Проверка окружения — до миграций, а не после.
     *
     * Раньше она стояла в `setUp()` после `parent::setUp()`. Но
     * `parent::setUp()` внутри себя зовёт `setUpTraits()`, а тот —
     * `RefreshDatabase::refreshDatabase()`, то есть `migrate:fresh`.
     * Значит защита срабатывала уже после того, как база вычищена.
     *
     * На что это влияло. `DB_DATABASE` в `phpunit.xml` задан без
     * `force="true"`, и переменная оболочки его перебивает — это сделано
     * нарочно, чтобы у каждого рабочего дерева была своя база. Но та же
     * дорога вела и к боевой: `DB_DATABASE=modelizmclub php artisan test`
     * в каталоге прода сносил бы боевую схему, а сообщение «база должна
     * называться modelizmclub_test*» человек прочёл бы после.
     *
     * `refreshApplication()` вызывается раньше `setUpTraits()`, поэтому
     * проверка здесь стоит до первой миграции. И бросает исключение, а не
     * `$this->fail()`: прогон должен остановиться целиком, а не выдать
     * тысячу красных тестов, среди которых причина теряется.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        $this->assertEnvironmentIsSafeForTests();
    }

    private function assertEnvironmentIsSafeForTests(): void
    {
        // Прогон с боевым окружением — это прогон против боевых доступов:
        // SMS, банк, почта. Имя базы проверяется ниже, но база — не единственное,
        // что тесты трогают снаружи.
        if (! app()->environment('testing')) {
            throw new RuntimeException('Tests must run with APP_ENV=testing, got: '.app()->environment());
        }

        if ((string) config('sms.iqsms.login') !== '' || (string) config('sms.mts.login') !== '' || (string) config('sms.mts.token') !== '') {
            throw new RuntimeException('Tests must not see real SMS credentials (IQSMS_LOGIN / MTS_LOGIN / MTS_TOKEN). See phpunit.xml.');
        }

        if (config('database.default') !== 'pgsql') {
            throw new RuntimeException(
                'Tests must run on PostgreSQL (DB_CONNECTION=pgsql). Got: '.config('database.default')
            );
        }

        $database = (string) config('database.connections.pgsql.database');
        if (! str_starts_with($database, self::TEST_DATABASE_PREFIX)) {
            throw new RuntimeException(
                'Tests must use an isolated database named '.self::TEST_DATABASE_PREFIX.'*, got: '.$database.'. '
                .'Run deploy/scripts/setup-test-db.sh and php artisan config:clear before testing.'
            );
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

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

    /**
     * Уровень `feed.compose.open` в карте доступа — тот, по которому сервер
     * решает, нужна ли подписка для записи (RequiresSubscription с ключом).
     *
     * По умолчанию в реестре — `subscription`. Тесты механики ленты, модерации
     * и уведомлений создают записи обычными пользователями: им ставится `auth`,
     * законная настройка из админки. Сам доступ проверяет
     * PostSubscriptionGateTest.
     */
    protected function setComposeTier(string $tier): void
    {
        $this->setActionTier('feed.compose.open', $tier);
    }

    /** Уровень одного действия в карте доступа; остальные сохраняются. */
    protected function setActionTier(string $action, string $tier): void
    {
        $row = SystemSetting::query()->where('key', FeedGuestAccessRegistry::SETTING_KEY)->first();
        $config = is_array($row?->value) ? $row->value : FeedGuestAccessRegistry::defaultConfig();
        $config['actions'][$action]['min_tier'] = $tier;
        SystemSetting::query()->updateOrCreate(
            ['key' => FeedGuestAccessRegistry::SETTING_KEY],
            ['group' => 'feed', 'value' => $config],
        );
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
