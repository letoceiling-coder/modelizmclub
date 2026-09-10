<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Уборка журналов, которые пишутся на каждое действие и никем не читаются
 * дольше своего срока: client_logs и banner_events. Сроки — в
 * config/retention.php, там же объяснено, почему они разные.
 *
 * Показы баннеров перед удалением сворачиваются в banner_event_daily.
 * Свёртка и удаление одной пачки идут в одной транзакции: иначе падение
 * между ними либо потеряет строки, не сложив их, либо сложит дважды.
 *
 * audit_logs не трогаем — журнал решений должен жить долго.
 */
class PruneLogsCommand extends Command
{
    protected $signature = 'logs:prune
        {--days-client-logs= : Срок хранения client_logs, по умолчанию из config/retention.php}
        {--days-banner-events= : Срок хранения banner_events, по умолчанию из config/retention.php}
        {--chunk=1000 : Сколько строк удалять за раз}
        {--dry-run : Ничего не удалять, только показать, что попало бы под уборку}';

    protected $description = 'Удалить старые client_logs и banner_events, свернув показы баннеров в дневные итоги';

    public function handle(): int
    {
        $chunk = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');

        $clientLogDays = $this->days('days-client-logs', 'retention.client_logs_days', 30);
        $bannerEventDays = $this->days('days-banner-events', 'retention.banner_events_days', 90);

        /*
         * now() здесь московское — APP_TIMEZONE=Europe/Moscow, — и колонки
         * created_at хранят московское же стенное время. Сравнение сходится.
         * Брать now() из SQL было бы ошибкой на три часа: в Postgres он UTC.
         */
        $clientLogCutoff = now()->subDays($clientLogDays);
        $bannerEventCutoff = now()->subDays($bannerEventDays);

        if ($dryRun) {
            $this->line('Пробный прогон: ничего не удаляется.');
        }

        $clientLogsDeleted = $this->pruneClientLogs($clientLogCutoff, $chunk, $dryRun);
        $bannerEventsDeleted = $this->pruneBannerEvents($bannerEventCutoff, $chunk, $dryRun);

        $verb = $dryRun ? 'попадает под уборку' : 'удалено';
        $this->info("client_logs: {$verb} {$clientLogsDeleted} (старше {$clientLogDays} дн., до {$clientLogCutoff->toDateTimeString()})");
        $this->info("banner_events: {$verb} {$bannerEventsDeleted} (старше {$bannerEventDays} дн., до {$bannerEventCutoff->toDateTimeString()})");

        return self::SUCCESS;
    }

    private function days(string $option, string $configKey, int $fallback): int
    {
        $value = $this->option($option);

        if ($value !== null && $value !== '') {
            return max(1, (int) $value);
        }

        return max(1, (int) config($configKey, $fallback));
    }

    private function pruneClientLogs(Carbon $cutoff, int $chunk, bool $dryRun): int
    {
        if ($dryRun) {
            return (int) DB::table('client_logs')->where('created_at', '<', $cutoff)->count();
        }

        $deleted = 0;

        while (true) {
            $ids = DB::table('client_logs')
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table('client_logs')->whereIn('id', $ids)->delete();
        }

        return $deleted;
    }

    private function pruneBannerEvents(Carbon $cutoff, int $chunk, bool $dryRun): int
    {
        if ($dryRun) {
            return (int) DB::table('banner_events')->where('created_at', '<', $cutoff)->count();
        }

        $deleted = 0;

        while (true) {
            $ids = DB::table('banner_events')
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::transaction(function () use ($ids): int {
                $this->rollUpIntoDaily($ids->all());

                return DB::table('banner_events')->whereIn('id', $ids)->delete();
            });
        }

        return $deleted;
    }

    /**
     * Свернуть пачку сырых событий в дневные итоги.
     *
     * Прибавление, а не замена: пачка может содержать часть суток, а
     * остаток той же даты приедет следующей пачкой или следующим прогоном.
     * Двойного счёта это не даёт, потому что каждая строка сворачивается
     * ровно один раз — в той же транзакции она и удаляется.
     *
     * @param  array<int, int>  $ids
     */
    private function rollUpIntoDaily(array $ids): void
    {
        $rows = DB::table('banner_events')
            ->whereIn('id', $ids)
            ->selectRaw('banner_id, event, created_at::date as day, count(*) as cnt')
            ->groupBy('banner_id', 'event', DB::raw('created_at::date'))
            ->get();

        foreach ($rows as $row) {
            DB::statement(
                'INSERT INTO banner_event_daily (banner_id, event, day, count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT (banner_id, event, day)
                 DO UPDATE SET count = banner_event_daily.count + EXCLUDED.count, updated_at = EXCLUDED.updated_at',
                [$row->banner_id, $row->event, $row->day, $row->cnt, now(), now()]
            );
        }
    }
}
