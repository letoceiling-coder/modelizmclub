<?php

namespace Tests\Feature;

use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Уборка журналов трогает боевые данные и удаляет их безвозвратно, поэтому
 * проверяется не только «сколько удалила», но и что уцелело, и что свёртка
 * показов не соврала.
 *
 * Отдельно проверяется пробный прогон: команда, которая в --dry-run
 * показывает не то же самое число, что удалит потом, хуже отсутствия
 * пробного прогона — на неё полагаются перед боевым запуском.
 */
class PruneLogsCommandTest extends TestCase
{
    use RefreshDatabase;

    private function clientLog(string $clientId, int $daysAgo): void
    {
        DB::table('client_logs')->insert([
            'client_id' => $clientId,
            'level' => 'info',
            'tag' => 'app',
            'message' => 'проверка',
            'created_at' => now()->subDays($daysAgo),
        ]);
    }

    private function bannerEvent(int $bannerId, string $event, int $daysAgo): void
    {
        DB::table('banner_events')->insert([
            'banner_id' => $bannerId,
            'event' => $event,
            'created_at' => now()->subDays($daysAgo),
        ]);
    }

    private function banner(): Banner
    {
        return Banner::query()->create([
            'placement' => 'feed',
            'title' => 'Баннер',
            'is_active' => true,
        ]);
    }

    public function test_deletes_only_rows_older_than_retention(): void
    {
        $this->clientLog('old-1', 40);
        $this->clientLog('old-2', 31);
        $this->clientLog('fresh-1', 29);
        $this->clientLog('fresh-2', 1);

        $this->artisan('logs:prune', ['--days-client-logs' => 30])->assertSuccessful();

        $left = DB::table('client_logs')->pluck('client_id')->sort()->values()->all();
        $this->assertSame(['fresh-1', 'fresh-2'], $left);
    }

    public function test_dry_run_changes_nothing_and_reports_the_same_number(): void
    {
        $this->clientLog('old-1', 40);
        $this->clientLog('old-2', 40);
        $this->clientLog('fresh', 1);

        $this->artisan('logs:prune', ['--days-client-logs' => 30, '--dry-run' => true])
            ->expectsOutputToContain('client_logs: попадает под уборку 2')
            ->assertSuccessful();

        $this->assertSame(3, DB::table('client_logs')->count());

        $this->artisan('logs:prune', ['--days-client-logs' => 30])
            ->expectsOutputToContain('client_logs: удалено 2')
            ->assertSuccessful();

        $this->assertSame(1, DB::table('client_logs')->count());
    }

    public function test_banner_events_are_rolled_up_before_deletion(): void
    {
        $banner = $this->banner();

        // Три показа и клик в один день, два показа — в другой.
        $this->bannerEvent($banner->id, 'impression', 100);
        $this->bannerEvent($banner->id, 'impression', 100);
        $this->bannerEvent($banner->id, 'impression', 100);
        $this->bannerEvent($banner->id, 'click', 100);
        $this->bannerEvent($banner->id, 'impression', 95);
        // Свежий — уборки не касается.
        $this->bannerEvent($banner->id, 'impression', 3);

        $this->artisan('logs:prune', ['--days-banner-events' => 90])->assertSuccessful();

        $this->assertSame(1, DB::table('banner_events')->count());

        $daily = DB::table('banner_event_daily')
            ->orderBy('day')
            ->orderBy('event')
            ->get()
            ->map(fn ($r) => [$r->event, (int) $r->count])
            ->all();

        $this->assertSame([['click', 1], ['impression', 3], ['impression', 1]], $daily);
    }

    public function test_roll_up_across_chunks_does_not_double_count(): void
    {
        $banner = $this->banner();

        for ($i = 0; $i < 7; $i++) {
            $this->bannerEvent($banner->id, 'impression', 100);
        }

        // Пачка меньше числа строк одного дня: свёртка обязана сложить
        // остаток к уже записанному, а не переписать его.
        $this->artisan('logs:prune', ['--days-banner-events' => 90, '--chunk' => 2])->assertSuccessful();

        $this->assertSame(0, DB::table('banner_events')->count());
        $this->assertSame(7, (int) DB::table('banner_event_daily')->value('count'));
    }

    public function test_second_run_leaves_daily_totals_alone(): void
    {
        $banner = $this->banner();
        $this->bannerEvent($banner->id, 'impression', 100);
        $this->bannerEvent($banner->id, 'impression', 100);

        $this->artisan('logs:prune', ['--days-banner-events' => 90])->assertSuccessful();
        $this->artisan('logs:prune', ['--days-banner-events' => 90])->assertSuccessful();

        $this->assertSame(2, (int) DB::table('banner_event_daily')->value('count'));
    }

    public function test_audit_logs_are_not_touched(): void
    {
        DB::table('audit_logs')->insert([
            'action' => 'test.action',
            'created_at' => now()->subYears(2),
        ]);

        $this->artisan('logs:prune')->assertSuccessful();

        $this->assertSame(1, DB::table('audit_logs')->count());
    }
}
