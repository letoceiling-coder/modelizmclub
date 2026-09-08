<?php

namespace App\Console\Commands;

use App\Enums\ContentStatus;
use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ModerationAction;
use App\Models\ModerationQueue;
use App\Models\Post;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Сверка очереди модерации с тем, что на самом деле произошло с объектом.
 *
 * Очередь — рабочий список модератора, а не ворота: видимость решает статус
 * самого объекта. Пока оба меняются одним путём, они сходятся. Стоит появиться
 * второму пути — расходятся молча.
 *
 * Так и вышло. Редактор объявлений в админке присваивал `status` напрямую и
 * очередь не трогал: 01.09 пять объявлений уехали из `pending_moderation` в
 * `published`, а их задачи остались висеть. Модератор видел пять задач,
 * решённых неделю назад. Путь починен 08.09, но старые строки сами не
 * исправятся.
 *
 * Команда не решает за модератора. Она берёт только те строки, где объект
 * уже пришёл к развязке, которую очередь описать обязана: опубликован или
 * отклонён. Всё остальное — снят с публикации, продан, черновик — оставляет
 * как есть и показывает отдельно: там решение неочевидно, и угадывать его
 * нельзя.
 *
 * Автора решения восстанавливает по журналу аудита: `admin.listings.update`
 * хранит и кто менял, и когда, и с какого статуса на какой. Найденное
 * записывается в `moderation_actions` с пометкой, что это восстановление, а
 * не живое решение. Не найденное — не выдумывается: очередь чинится, запись
 * в журнал не пишется, и об этом сказано в отчёте.
 *
 * Без `--apply` только показывает.
 */
class ReconcileModerationQueueCommand extends Command
{
    protected $signature = 'moderation:reconcile-queue
        {--apply : применить изменения; без флага только разбор}';

    protected $description = 'Свести очередь модерации с фактическим состоянием объектов';

    /** Объект опубликован — очередь обязана показывать «одобрено». */
    private const TO_APPROVED = 'approved';

    /** Объект отклонён — очередь обязана показывать «отклонено». */
    private const TO_REJECTED = 'rejected';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');

        /** @var Collection<int, ModerationQueue> $open */
        $open = ModerationQueue::query()
            ->whereIn('status', ['pending', 'revision'])
            ->with('moderatable')
            ->orderBy('id')
            ->get();

        if ($open->isEmpty()) {
            $this->info('Открытых задач в очереди нет.');

            return self::SUCCESS;
        }

        $fixable = [];
        $leftAlone = [];

        foreach ($open as $row) {
            $target = $row->moderatable;

            if ($target === null) {
                // Осиротевшие строки закрывает сама очередь при открытии —
                // `cancelOrphanedEntries`. Сюда они попасть не должны, но если
                // попали, чинить их не наше дело.
                $leftAlone[] = [$row, 'объекта нет'];

                continue;
            }

            $verdict = $this->verdictFor($target);

            if ($verdict === null) {
                $leftAlone[] = [$row, 'статус объекта: '.$this->statusOf($target)];

                continue;
            }

            $fixable[] = [$row, $target, $verdict];
        }

        $this->line(sprintf(
            '%s: открытых задач %d, из них расходятся с фактом %d.',
            $apply ? 'Сверка с записью' : 'Сверка без записи (добавьте --apply)',
            $open->count(),
            count($fixable),
        ));
        $this->newLine();

        foreach ($fixable as [$row, $target, $verdict]) {
            $decision = $this->decisionFromAudit($target);

            $this->line(sprintf(
                '  #%-5s %-9s %-28s %s -> %s%s',
                $row->id,
                $row->queue,
                mb_substr((string) ($target->title ?? '—'), 0, 28),
                $row->status,
                $verdict,
                $decision !== null
                    ? sprintf('   (решил id %s, %s)', $decision->user_id, $decision->created_at)
                    : '   (автор решения по журналу не найден)',
            ));

            if ($apply) {
                $this->applyFix($row, $target, $verdict, $decision);
            }
        }

        if ($leftAlone !== []) {
            $this->newLine();
            $this->line('Оставлено как есть — развязка неочевидна:');
            foreach ($leftAlone as [$row, $why]) {
                $this->line(sprintf('  #%-5s %-9s %s', $row->id, $row->queue, $why));
            }
        }

        if (! $apply) {
            $this->newLine();
            $this->warn('Ничего не записано. Для применения: --apply');

            return self::SUCCESS;
        }

        $this->verifyIndependently();

        return self::SUCCESS;
    }

    /**
     * Что очередь обязана показывать по нынешнему состоянию объекта.
     *
     * Только две развязки, обе однозначные. Остальные статусы сюда не
     * попадают нарочно: «снят с публикации» и «продан» не говорят, была
     * модерация или нет.
     */
    private function verdictFor(object $target): ?string
    {
        if ($target instanceof Listing) {
            return match ($target->status) {
                ListingStatus::Published => self::TO_APPROVED,
                ListingStatus::Rejected => self::TO_REJECTED,
                default => null,
            };
        }

        if ($target instanceof Post) {
            return match ($target->status) {
                ContentStatus::Published => self::TO_APPROVED,
                ContentStatus::Rejected => self::TO_REJECTED,
                default => null,
            };
        }

        return null;
    }

    private function statusOf(object $target): string
    {
        $status = $target->status ?? null;

        if ($status instanceof \BackedEnum) {
            return (string) $status->value;
        }

        return (string) ($status ?? 'неизвестен');
    }

    /**
     * Кто и когда увёл объект в нынешний статус — по журналу аудита.
     *
     * Ищем последнюю запись админского редактора по этому объекту, у которой
     * новый статус совпадает с нынешним. Это и есть решение, не попавшее в
     * журнал модерации.
     */
    private function decisionFromAudit(object $target): ?object
    {
        if (! $target instanceof Listing) {
            return null;
        }

        return DB::table('audit_logs')
            ->where('action', 'admin.listings.update')
            ->where('auditable_id', $target->id)
            ->whereRaw("new_values->>'status' = ?", [$this->statusOf($target)])
            ->orderByDesc('id')
            ->first();
    }

    private function applyFix(ModerationQueue $row, object $target, string $verdict, ?object $decision): void
    {
        DB::transaction(function () use ($row, $target, $verdict, $decision): void {
            $row->update(['status' => $verdict]);

            if ($decision === null || $decision->user_id === null) {
                return;
            }

            /*
             * Запись в журнал модерации — восстановленная, и это сказано в
             * ней самой. Выдавать её за живое решение нельзя: модератор
             * нажимал не кнопку очереди, а «сохранить» в редакторе, и
             * причины отклонения там не было.
             */
            ModerationAction::query()->create([
                'moderatable_type' => $target::class,
                'moderatable_id' => $target->getKey(),
                'actor_id' => $decision->user_id,
                'action' => $verdict === self::TO_APPROVED ? 'approve' : 'reject',
                'reason' => 'Восстановлено сверкой: решение принято в редакторе админки, минуя очередь.',
                'metadata' => [
                    'source' => 'moderation:reconcile-queue',
                    'audit_log_id' => $decision->id,
                    'decided_at' => (string) $decision->created_at,
                ],
            ]);
        });
    }

    /**
     * Проверка с другой стороны.
     *
     * Считать итог тем же условием, каким шла правка, бессмысленно: сломанное
     * условие сломано в обеих половинах одинаково. Пересчитываем по факту —
     * сколько осталось строк, где открытая задача висит на опубликованном или
     * отклонённом объекте.
     */
    private function verifyIndependently(): void
    {
        $stale = ModerationQueue::query()
            ->whereIn('status', ['pending', 'revision'])
            ->where(function ($q): void {
                $q->whereHasMorph('moderatable', [Listing::class], function ($l): void {
                    $l->whereIn('status', [ListingStatus::Published->value, ListingStatus::Rejected->value]);
                })->orWhereHasMorph('moderatable', [Post::class], function ($p): void {
                    $p->whereIn('status', [ContentStatus::Published->value, ContentStatus::Rejected->value]);
                });
            })
            ->count();

        $this->newLine();
        $this->line("Осталось расхождений: {$stale}.");

        if ($stale > 0) {
            $this->error('Не все строки сведены. Разберитесь до следующего запуска.');
        }
    }
}
