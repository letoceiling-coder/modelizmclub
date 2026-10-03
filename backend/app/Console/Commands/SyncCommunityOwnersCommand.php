<?php

namespace App\Console\Commands;

use App\Console\Concerns\GuardsDataWrites;
use App\Enums\CommunityMemberRole;
use App\Models\Community;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Выровнять `communities.created_by` по владельцу из `community_members`.
 *
 * Сухой прогон по умолчанию, запись — по `--apply`.
 *
 * ПОЧЕМУ. До 03.10 команда писала сразу: массовый `UPDATE` без `where id = ?`
 * и без возможности сначала посмотреть. Это ровно тот случай, под который в
 * `CLAUDE.md` написано «массовое изменение данных сначала с `--dry-run`», и
 * флага у неё не было.
 *
 * Там же сказано, почему считать затронутые строки тем же условием, что стоит
 * в правке, бессмысленно: сломано условие — сломаны обе половины одинаково.
 * Поэтому отчёт печатает не количество, а каждую строку с прежним и новым
 * значением, и прежнее читается отдельным запросом, а не выводится из того же
 * условия. Ошибочный отбор видно по колонке «было»: там окажется тот, кого
 * никто не ожидал.
 */
class SyncCommunityOwnersCommand extends Command
{
    use GuardsDataWrites;

    protected $signature = 'communities:sync-owners
        {--apply : Записать изменения. Без этого довода только отчёт}
        {--force : Не спрашивать подтверждения (для скриптов)}';

    protected $description = 'Сверить communities.created_by с владельцем из community_members (без --apply только показывает)';

    public function handle(): int
    {
        $владельцы = DB::table('community_members')
            ->where('role', CommunityMemberRole::Owner->value)
            ->orderBy('community_id')
            ->get(['community_id', 'user_id']);

        $расхождения = [];

        foreach ($владельцы as $строка) {
            $нынешнее = Community::query()
                ->whereKey($строка->community_id)
                ->value('created_by');

            if ((int) $нынешнее === (int) $строка->user_id) {
                continue;
            }

            $расхождения[] = [
                'community_id' => (int) $строка->community_id,
                'было' => $нынешнее === null ? '—' : (string) $нынешнее,
                'станет' => (int) $строка->user_id,
            ];
        }

        if ($расхождения === []) {
            $this->info('communities:sync-owners: расхождений нет, менять нечего.');

            return self::SUCCESS;
        }

        $this->table(['Сообщество', 'created_by было', 'станет'], array_map(
            fn (array $р): array => [$р['community_id'], $р['было'], $р['станет']],
            $расхождения,
        ));

        if (! $this->writesOnlyWithApply()) {
            $this->warn('Сухой прогон: найдено '.count($расхождения).' расхождени(е/я), ничего не записано.');
            $this->line('  Записать: php artisan communities:sync-owners --apply');

            return self::SUCCESS;
        }

        $база = (string) config('database.connections.'.config('database.default').'.database');

        if (! $this->confirmWrite(
            'Будет изменено '.count($расхождения).' сообществ(а) в колонке created_by. База: '.$база.'.'
        )) {
            return self::FAILURE;
        }

        $изменено = 0;

        foreach ($расхождения as $р) {
            $изменено += Community::query()
                ->whereKey($р['community_id'])
                ->update(['created_by' => $р['станет']]);
        }

        $this->info("communities:sync-owners: изменено {$изменено} сообществ(а).");

        return self::SUCCESS;
    }
}
