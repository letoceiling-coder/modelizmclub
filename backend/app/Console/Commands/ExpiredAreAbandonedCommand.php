<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Support\PaymentFailure;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Истёкший срок — это брошенная форма, а не отказ.
 *
 * ЧТО СЛУЧИЛОСЬ. 03.10 разбор спросил ЮKassa про 27 отказов июля и
 * августа. У **всех двадцати семи** причина одна:
 * `expired_on_confirmation` — человек дошёл до формы и не подтвердил
 * платёж. Банк отказа не выносил, он этих платежей не видел.
 *
 * Команда разбора причину записала, но статус не трогала — и правильно:
 * пересмотр решения о деньгах не делается пакетом заодно с чем-то ещё.
 * Это отдельное действие, и вот оно.
 *
 * ПОЧЕМУ ЭТО ВАЖНО, А НЕ КОСМЕТИКА. Воронка группирует причины по
 * `status = failed`, а шаги — по `failed` и `abandoned` вместе. Строка с
 * `expired` и шагом `form` попадала в «Отказано» и одновременно в
 * «открыл форму, не заплатил»: два графика об одних и тех же людях
 * говорили разное. И главное — «отказано» читается как «банк отклонил»,
 * а банк не отклонял. Двадцать семь таких строк превращают картину
 * «люди не доходят до оплаты» в «банк отказывает всем».
 *
 * ДЕНЕГ НЕ ДВИГАЕТ. `failed` и `abandoned` оба означают «денег нет»:
 * ни выдачи, ни возврата, ни холда за ними не стоит. Меняется только
 * имя исхода. Строки с `paid` команда не берёт ни при каких условиях.
 *
 * БЕЗ `--apply` НИЧЕГО НЕ ПИШЕТСЯ.
 */
class ExpiredAreAbandonedCommand extends Command
{
    protected $signature = 'payments:expired-are-abandoned
        {--apply : перенести; без флага — только показать}
        {--provider= : только этот провайдер}';

    protected $description = 'Перенести отказы с причиной «истёк срок» в статус «брошено»';

    public function handle(): int
    {
        $платежи = $this->выборка()->get();

        if ($платежи->isEmpty()) {
            $this->info('Переносить нечего.');

            return self::SUCCESS;
        }

        $this->line('Строки с причиной «истёк срок», лежащие в «отказано» ('.$платежи->count().'):');
        $this->table(
            ['создан', 'uuid', 'провайдер', 'сумма', 'шаг', 'причина'],
            $платежи->map(fn (Payment $p) => [
                (string) $p->created_at?->format('d.m.Y H:i'),
                mb_substr((string) $p->uuid, 0, 8),
                (string) $p->provider,
                number_format($p->amount_cents / 100, 2, ',', ' '),
                (string) $p->failure_stage,
                (string) $p->failure_code,
            ])->all(),
        );

        /*
         * Проверка выборки независимым запросом: считать тем же
         * условием, что стоит в правке, бессмысленно — сломано условие,
         * сломаны обе половины одинаково. Смотрим с другой стороны: нет
         * ли среди них оплаченных или уже брошенных.
         */
        $чужие = Payment::query()
            ->whereIn('uuid', $платежи->pluck('uuid'))
            ->whereNotIn('status', ['failed'])
            ->count();
        if ($чужие > 0) {
            $this->error('В выборке '.$чужие.' строк не в статусе «отказано» — остановитесь и разберитесь.');

            return self::FAILURE;
        }

        if (! $this->option('apply')) {
            $this->newLine();
            $this->warn('Сухой прогон: ничего не записано.');
            $this->line('Перенести: php artisan payments:expired-are-abandoned --apply');

            return self::SUCCESS;
        }

        $перенесено = DB::transaction(fn () => $this->выборка()->update([
            'status' => 'abandoned',
            'failure_code' => 'abandoned',
            'failure_stage' => PaymentFailure::STAGE_FORM,
            'updated_at' => now(),
        ]));

        $this->newLine();
        $this->line('Перенесено строк: '.$перенесено);

        // Пересчёт по базе, а не по счётчику, который накапливала запись.
        $осталось = Payment::query()
            ->where('status', 'failed')
            ->where('failure_code', 'expired')
            ->count();
        $this->line('Осталось «истёкших» в «отказано»: '.$осталось);
        $this->line('Теперь в «брошено» всего: '.Payment::query()->where('status', 'abandoned')->count());

        return self::SUCCESS;
    }

    /** @return \Illuminate\Database\Eloquent\Builder<Payment> */
    private function выборка()
    {
        $провайдер = (string) ($this->option('provider') ?? '');

        return Payment::query()
            ->where('status', 'failed')
            ->where('failure_code', 'expired')
            ->when($провайдер !== '', fn ($q) => $q->where('provider', $провайдер))
            ->orderBy('created_at');
    }
}
