<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Banner;
use App\Models\Promocode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Services\AuditService;
use Modules\Billing\Services\PromocodeService;
use Tests\TestCase;

/**
 * Даты из форм админки в поясе прода: приложение по Москве, сессия Postgres UTC.
 * В обычном прогоне пояс UTC, и сдвиг на три часа не виден — поэтому каждый
 * случай здесь идёт через inAppTimezone().
 */
class FormDatesTimezoneTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
    }

    public function test_promocode_valid_until_date_means_through_the_end_of_that_moscow_day(): void
    {
        $admin = $this->admin();

        $this->inAppTimezone('Europe/Moscow', function () use ($admin): void {
            $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/promocodes', [
                'code' => 'NEWYEAR',
                'type' => 'percent',
                'scope' => 'all',
                'value' => 10,
                'valid_from' => '2026-12-01',
                'valid_until' => '2026-12-31',
            ])->assertCreated();

            $promo = Promocode::query()->where('code', 'NEWYEAR')->firstOrFail();
            $this->assertSame('2026-12-01 00:00:00', $promo->valid_from->setTimezone('Europe/Moscow')->format('Y-m-d H:i:s'));
            $this->assertSame('2026-12-31 23:59:59', $promo->valid_until->setTimezone('Europe/Moscow')->format('Y-m-d H:i:s'));

            // Таблица админки берёт дату как slice(0, 10) — там должен быть введённый день.
            $row = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/promocodes')->assertOk()->json('data.data.0');
            $this->assertStringStartsWith('2026-12-31', $row['valid_until']);
            $this->assertStringStartsWith('2026-12-01', $row['valid_from']);

            $service = app(PromocodeService::class);
            $user = User::factory()->create(['status' => UserStatus::Active]);

            // 31.12 в 20:00 по Москве — ещё действует.
            Carbon::setTestNow(Carbon::parse('2026-12-31 20:00:00', 'Europe/Moscow'));
            $this->assertSame($promo->id, $service->findValid('NEWYEAR', $user, 'subscription')->id);

            // 1.01 в 00:01 — уже нет.
            Carbon::setTestNow(Carbon::parse('2027-01-01 00:01:00', 'Europe/Moscow'));
            try {
                $service->findValid('NEWYEAR', $user, 'subscription');
                $this->fail('Промокод должен истечь после конца 31.12 по Москве.');
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            } finally {
                Carbon::setTestNow();
            }
        });
    }

    public function test_banner_can_run_for_a_single_moscow_day(): void
    {
        $admin = $this->admin();

        $this->inAppTimezone('Europe/Moscow', function () use ($admin): void {
            $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/banners', [
                'placement' => 'events',
                'title' => 'Один день',
                'starts_at' => '2026-10-01',
                'ends_at' => '2026-10-01',
            ])->assertCreated();

            $banner = Banner::query()->where('title', 'Один день')->firstOrFail();
            $this->assertSame('2026-10-01 00:00:00', $banner->starts_at->setTimezone('Europe/Moscow')->format('Y-m-d H:i:s'));
            $this->assertSame('2026-10-01 23:59:59', $banner->ends_at->setTimezone('Europe/Moscow')->format('Y-m-d H:i:s'));
        });
    }

    public function test_audit_log_time_is_moscow_like_every_other_record(): void
    {
        $admin = $this->admin();

        $this->inAppTimezone('Europe/Moscow', function () use ($admin): void {
            Carbon::setTestNow(Carbon::parse('2026-09-14 13:00:00', 'Europe/Moscow'));
            try {
                app(AuditService::class)->log($admin, 'test.timezone', $admin);

                $log = AuditLog::query()->where('action', 'test.timezone')->firstOrFail();
                $this->assertSame('2026-09-14 13:00', $log->created_at->setTimezone('Europe/Moscow')->format('Y-m-d H:i'));

                $row = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/audit-logs')->assertOk()->json('data.data.0');
                $this->assertTrue(
                    Carbon::parse($row['created_at'])->equalTo(Carbon::parse('2026-09-14 13:00:00', 'Europe/Moscow')),
                    'журнал отдал '.$row['created_at'],
                );
            } finally {
                Carbon::setTestNow();
            }
        });
    }

    public function test_migration_moves_old_utc_audit_rows_to_moscow_and_back(): void
    {
        $this->inAppTimezone('Europe/Moscow', function (): void {
            // Строка прежним путём: created_at ставит база, сессия в UTC.
            $id = DB::table('audit_logs')->insertGetId(['action' => 'legacy.row']);
            $dbNowUtc = DB::selectOne("select to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as t")->t;
            $this->assertSame($dbNowUtc, substr((string) DB::table('audit_logs')->where('id', $id)->value('created_at'), 0, 16));

            $migration = require database_path('migrations/2026_09_14_200000_audit_logs_created_at_to_app_timezone.php');
            $migration->up();

            $moscow = DB::selectOne("select to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD HH24:MI') as t")->t;
            $this->assertSame($moscow, substr((string) DB::table('audit_logs')->where('id', $id)->value('created_at'), 0, 16));

            // Запись нового пути после миграции не сдвигается откатом.
            $newId = app(AuditService::class)->log(null, 'new.row')->id;
            $before = (string) DB::table('audit_logs')->where('id', $newId)->value('created_at');

            $migration->down();
            $this->assertSame($dbNowUtc, substr((string) DB::table('audit_logs')->where('id', $id)->value('created_at'), 0, 16));
            $this->assertSame($before, (string) DB::table('audit_logs')->where('id', $newId)->value('created_at'));
        });
    }
}
