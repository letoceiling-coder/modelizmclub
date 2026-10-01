<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Support\PaymentFailure;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Clients\VtbAcquiringClient;

/**
 * Спросить у банка, почему не прошли старые платежи ВТБ.
 *
 * ЗАЧЕМ. На 01.10 в боевой базе 54 настоящих отказа, и у всех одна и та
 * же причина — «Сверка: банк сообщил об отмене заказа». Её написали мы
 * сами: до 30.09 код банка (`actionCode`) не читался нигде. Отличить
 * «не хватило денег» от «закрыл форму» по этой строке нельзя, а воронка,
 * построенная на ней, скажет, что банк отклоняет всё подряд.
 *
 * ЧТО ВОССТАНОВИМО. У всех 32 платежей ВТБ есть `provider_payment_id` —
 * заказ в банке зарегистрирован, и банк до сих пор отвечает по нему
 * `getOrderStatusExtended`. У 27 платежей ЮKassa восстановить нечего:
 * провайдер убран как шлюз в spec v4.0, спрашивать некого, а журналы за
 * 19.07–04.08 не сохранились.
 *
 * ЧЕГО КОМАНДА НЕ ДЕЛАЕТ. Не меняет `status` и не трогает деньги. Это
 * восстановление причины, а не пересмотр решения. Если банк вдруг
 * ответит «оплачен» по платежу, который у нас отказан, команда об этом
 * громко скажет и строку пропустит: расхождение такого рода разбирают
 * руками, а не правят пакетом.
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ КОМАНДА. `payments:reconcile-pending` занимается
 * висящими платежами и выносит по ним решение. Здесь обратное: решение
 * давно вынесено, восстанавливается только его причина. Смешав их, мы
 * получили бы команду, которая по флагу делает разное с деньгами.
 *
 * БЕЗ `--apply` НИЧЕГО НЕ ПИШЕТСЯ И НИЧЕГО НЕ СПРАШИВАЕТСЯ У БАНКА.
 * Сухой прогон печатает тело запроса и список платежей — и только.
 */
class RecoverVtbFailureReasonsCommand extends Command
{
    protected $signature = 'payments:recover-vtb-reasons
        {--apply : спросить банк и записать причины; без флага — только показать, что будет}
        {--limit=0 : ограничить число платежей}
        {--delay-ms=300 : пауза между запросами к банку, мс}';

    protected $description = 'Восстановить причину отказа по старым платежам ВТБ: спросить банк и заполнить код, текст и шаг';

    public function handle(VtbAcquiringClient $client): int
    {
        $платежи = $this->выборка();

        if ($платежи->isEmpty()) {
            $this->info('Платежей без восстановимой причины нет.');

            return self::SUCCESS;
        }

        $this->показатьЗапрос($платежи->count());
        $this->показатьВыборку($платежи);

        if (! $this->option('apply')) {
            $this->newLine();
            $this->warn('Сухой прогон: к банку не обращались, в базу не писали.');
            $this->line('Запустить по-настоящему: php artisan payments:recover-vtb-reasons --apply');

            return self::SUCCESS;
        }

        return $this->выполнить($client, $платежи);
    }

    /**
     * Кого спрашиваем: отказ или брошенная форма, причина не записана,
     * номер заказа в банке есть.
     *
     * @return \Illuminate\Support\Collection<int, Payment>
     */
    private function выборка(): \Illuminate\Support\Collection
    {
        $q = Payment::query()
            ->where('provider', 'vtb')
            ->whereIn('status', ['failed', 'abandoned'])
            ->whereNull('failure_code')
            ->whereNotNull('provider_payment_id')
            ->orderBy('created_at');

        $предел = (int) $this->option('limit');
        if ($предел > 0) {
            $q->limit($предел);
        }

        return $q->get();
    }

    private function показатьЗапрос(int $сколько): void
    {
        $черезТокен = (bool) config('billing.vtb.token');

        $this->line('Запрос, который уйдёт в банк по каждому заказу:');
        $this->newLine();
        $this->line('  POST '.config('billing.vtb.api_url').'getOrderStatusExtended.do');
        $this->line('  Content-Type: application/x-www-form-urlencoded');
        $this->line('  Тело:');
        if ($черезТокен) {
            $this->line('    token=<из billing.vtb.token, в вывод не печатается>');
        } else {
            $this->line('    userName=<из billing.vtb.username, в вывод не печатается>');
            $this->line('    password=<из billing.vtb.password, в вывод не печатается>');
        }
        $this->line('    orderId=<provider_payment_id платежа>');
        $this->newLine();
        $this->line('  Запросов будет: '.$сколько.', пауза между ними '.(int) $this->option('delay-ms').' мс.');
        $this->line('  Чтение статуса. Деньги не двигаются: ни списания, ни возврата, ни отмены.');
        $this->newLine();
    }

    /** @param \Illuminate\Support\Collection<int, Payment> $платежи */
    private function показатьВыборку(\Illuminate\Support\Collection $платежи): void
    {
        $this->line('Платежи, по которым причина не записана ('.$платежи->count().'):');
        $this->table(
            ['создан', 'uuid', 'сумма', 'статус', 'шаг сейчас', 'заказ в банке'],
            $платежи->map(fn (Payment $p) => [
                (string) $p->created_at?->format('d.m.Y H:i'),
                mb_substr((string) $p->uuid, 0, 8),
                number_format($p->amount_cents / 100, 2, ',', ' '),
                (string) $p->status,
                (string) ($p->failure_stage ?? '—'),
                mb_substr((string) $p->provider_payment_id, 0, 12),
            ])->all(),
        );
    }

    /** @param \Illuminate\Support\Collection<int, Payment> $платежи */
    private function выполнить(VtbAcquiringClient $client, \Illuminate\Support\Collection $платежи): int
    {
        $пауза = max(0, (int) $this->option('delay-ms')) * 1000;
        $итог = [];
        $расхождения = 0;
        $ошибки = 0;

        foreach ($платежи as $платёж) {
            try {
                $ответ = $client->getOrderStatusExtended((string) $платёж->provider_payment_id);
            } catch (\Throwable $e) {
                $ошибки++;
                $this->warn(mb_substr((string) $платёж->uuid, 0, 8).': банк не ответил — '.$e->getMessage());
                usleep($пауза);

                continue;
            }

            if (VtbAcquiringClient::isPaidStatus($ответ)) {
                /*
                 * У нас отказ, у банка оплата. Это не причина отказа, а
                 * расхождение по деньгам: правим руками, разобравшись, а
                 * не пакетом.
                 */
                $расхождения++;
                $this->error(
                    mb_substr((string) $платёж->uuid, 0, 8)
                    .': банк отвечает «оплачен», а у нас «'.$платёж->status.'» — строка пропущена, разберите отдельно.'
                );
                usleep($пауза);

                continue;
            }

            ['code' => $код, 'message' => $текст] = VtbAcquiringClient::actionCode($ответ);
            $наш = PaymentFailure::fromVtbActionCode($код);
            $шаг = $наш === 'expired' ? PaymentFailure::STAGE_FORM : PaymentFailure::STAGE_BANK;

            $платёж->forceFill([
                'failure_code' => $наш,
                'failure_message' => $текст !== null ? mb_substr($текст, 0, 500) : null,
                'failure_stage' => $шаг,
                'decided_by' => PaymentFailure::BY_RECONCILE,
            ])->save();

            $итог[$наш] = ($итог[$наш] ?? 0) + 1;
            usleep($пауза);
        }

        $this->newLine();
        $this->line('Записано причин: '.array_sum($итог));
        foreach ($итог as $код => $сколько) {
            $this->line(sprintf('  %-22s %d', $код, $сколько));
        }
        if ($расхождения > 0) {
            $this->error('Расхождений «банк говорит оплачен»: '.$расхождения.' — разберите руками.');
        }
        if ($ошибки > 0) {
            $this->warn('Банк не ответил по '.$ошибки.' заказам — повторите позже.');
        }

        /*
         * Пересчёт по базе независимым запросом: считать по тому же
         * счётчику, что накапливала запись, — значит проверить сложение,
         * а не результат.
         */
        $осталось = DB::table('payments')
            ->where('provider', 'vtb')
            ->whereIn('status', ['failed', 'abandoned'])
            ->whereNull('failure_code')
            ->count();
        $this->line('Осталось без причины в базе: '.$осталось);

        return self::SUCCESS;
    }
}
