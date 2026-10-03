<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Support\PaymentFailure;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Clients\YooKassaClient;

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
class RecoverFailureReasonsCommand extends Command
{
    protected $signature = 'payments:recover-reasons
        {--apply : спросить банк и записать причины; без флага — только показать, что будет}
        {--limit=0 : ограничить число платежей}
        {--provider= : только этот провайдер (vtb или yookassa)}
        {--delay-ms= : пауза между запросами к банку, мс (по умолчанию из billing.vtb.reconcile)}';

    protected $description = 'Восстановить причину отказа по старым платежам ВТБ: спросить банк и заполнить код, текст и шаг';

    public function handle(VtbAcquiringClient $client, YooKassaClient $yooKassa): int
    {
        $платежи = $this->выборка();

        if ($платежи->isEmpty()) {
            $this->info('Платежей без восстановимой причины нет.');

            return self::SUCCESS;
        }

        $this->показатьЗапрос($платежи);
        $this->показатьВыборку($платежи);

        if (! $this->option('apply')) {
            $this->newLine();
            $this->warn('Сухой прогон: к банку не обращались, в базу не писали.');
            $this->line('Запустить по-настоящему: php artisan payments:recover-reasons --apply');

            return self::SUCCESS;
        }

        return $this->выполнить($client, $yooKassa, $платежи);
    }

    /**
     * Что ЮKassa говорит про этот платёж — и почему он не прошёл.
     *
     * Причина лежит в `cancellation_details.reason`, и до 02.10 её не
     * читал никто: сверка смотрела только `status`, то есть знала
     * «отменён», но не знала почему. При этом ключи магазина живые —
     * проверено 10.09, `GET /me` отвечает 200, — и 27 отказов июля и
     * августа считались невосстановимыми зря. Эту ошибку я и сделал,
     * объявив их таковыми: отрицательное утверждение без полного чтения.
     *
     * @param array<string, int> $итог
     * @param list<string>       $истёкшие
     */
    private function юkassa(
        YooKassaClient $client,
        Payment $платёж,
        array &$итог,
        int &$беззвёздочки,
        int &$ошибки,
        array &$истёкшие,
    ): void {
        $короткий = mb_substr((string) $платёж->uuid, 0, 8);

        try {
            $данные = $client->getPayment((string) $платёж->provider_payment_id);
        } catch (\Throwable $e) {
            $ошибки++;
            $this->warn($короткий.': ЮKassa не ответила — '.$e->getMessage());

            return;
        }

        $статус = $данные['status'] ?? null;

        if ($статус === 'succeeded') {
            // То же расхождение по деньгам, что и у банка: разбирают руками.
            $this->error($короткий.': ЮKassa отвечает «succeeded», а у нас «'.$платёж->status.'» — строка пропущена.');

            return;
        }

        $причина = $данные['cancellation_details']['reason'] ?? null;
        $кто = $данные['cancellation_details']['party'] ?? null;
        $наш = PaymentFailure::fromYooKassaReason(is_string($причина) ? $причина : null);

        if ($наш === null) {
            $беззвёздочки++;
            $this->line(sprintf(
                '  %s  status=%s cancellation_details — нет, причина не названа, строка не тронута',
                $короткий,
                is_string($статус) ? $статус : '—',
            ));

            return;
        }

        $шаг = $наш === 'expired' ? PaymentFailure::STAGE_FORM : PaymentFailure::STAGE_BANK;

        // Имя причины и кто отменил — дословно: наш код это пересказ, а
        // пересказ может оказаться неверным, и тогда понадобится исходник.
        $сообщение = 'reason '.$причина.($кто !== null ? ', party '.$кто : '');

        $платёж->forceFill([
            'failure_code' => $наш,
            'failure_message' => mb_substr($сообщение, 0, 500),
            'failure_stage' => $шаг,
        ])->save();

        $this->line(sprintf(
            '  %s  status=%-10s reason=%-24s → %s (%s)',
            $короткий,
            is_string($статус) ? $статус : '—',
            (string) $причина,
            $наш,
            PaymentFailure::stageLabels()[$шаг] ?? $шаг,
        ));

        if ($наш === 'expired') {
            $истёкшие[] = $короткий;
        }

        $итог[$наш] = ($итог[$наш] ?? 0) + 1;
    }

    /**
     * Кого спрашиваем: отказ или брошенная форма, причина не записана,
     * номер заказа в банке есть.
     *
     * @return \Illuminate\Support\Collection<int, Payment>
     */
    private function выборка(): \Illuminate\Support\Collection
    {
        $провайдер = (string) ($this->option('provider') ?? '');

        $q = Payment::query()
            ->whereIn('provider', ['vtb', 'yookassa'])
            ->whereIn('status', ['failed', 'abandoned'])
            ->whereNull('failure_code')
            ->whereNotNull('provider_payment_id')
            ->when($провайдер !== '', fn ($q) => $q->where('provider', $провайдер))
            ->orderBy('created_at');

        $предел = (int) $this->option('limit');
        if ($предел > 0) {
            $q->limit($предел);
        }

        return $q->get();
    }

    /**
     * Что уйдёт наружу — по каждому провайдеру отдельно.
     *
     * Прежняя версия печатала один запрос, ВТБ-овский, и писала «запросов
     * будет 54» — хотя половина уходит в ЮKassa, другим адресом и другим
     * телом. Сухой прогон затем и нужен, чтобы человек увидел, что именно
     * отправится; обещать не то — хуже, чем не печатать вовсе.
     *
     * @param \Illuminate\Support\Collection<int, Payment> $платежи
     */
    private function показатьЗапрос(\Illuminate\Support\Collection $платежи): void
    {
        $поПровайдеру = $платежи->countBy('provider');
        $пауза = (int) ($this->option('delay-ms') ?? config('billing.vtb.reconcile.delay_ms', 1000));

        $this->line('Запросы, которые уйдут наружу:');
        $this->newLine();

        if (($ювтб = (int) ($поПровайдеру['vtb'] ?? 0)) > 0) {
            $this->показатьВтб($ювтб);
        }
        if (($юю = (int) ($поПровайдеру['yookassa'] ?? 0)) > 0) {
            $this->показатьЮkassa($юю);
        }

        $this->line('  Всего запросов: '.$платежи->count().', пауза между ними '.$пауза.' мс.');
        $this->line('  Чтение статуса. Деньги не двигаются: ни списания, ни возврата, ни отмены.');
        $this->newLine();
    }

    private function показатьВтб(int $сколько): void
    {
        $черезТокен = (bool) config('billing.vtb.token');

        $this->line("  ВТБ — {$сколько} шт.:");
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

        /*
         * Боевой это контур или испытательный — видно по адресу, и
         * сказать об этом надо здесь, а не в чужом отчёте: коды
         * песочницы, записанные в боевые строки, хуже пустоты.
         */
        if (str_contains((string) config('billing.vtb.api_url'), 'rbsuat')) {
            $this->warn('  ВНИМАНИЕ: адрес указывает на испытательный контур ВТБ (rbsuat).');
            $this->warn('  Ответы оттуда не объясняют отказы живых карт — применять нельзя.');
        }
        $this->newLine();
    }

    private function показатьЮkassa(int $сколько): void
    {
        $this->line("  ЮKassa — {$сколько} шт.:");
        $this->line('  GET https://api.yookassa.ru/v3/payments/<provider_payment_id>');
        $this->line('  Authorization: Basic <shop_id:secret_key, в вывод не печатается>');
        $this->line('  Причина берётся из cancellation_details: reason и party.');
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
    private function выполнить(VtbAcquiringClient $client, YooKassaClient $yooKassa, \Illuminate\Support\Collection $платежи): int
    {
        /*
         * Пауза — из той же настройки, что у сверки. 08.09 залп из 47
         * заказов получил 429 по двадцати семи и дал ложную раскладку;
         * тысяча миллисекунд — вывод из того дня. Своя цифра здесь
         * означала бы повторить его втрое чаще, да ещё и деля лимит с
         * автоопросом, который ходит в тот же банк каждые пять минут.
         */
        $пауза = max(0, (int) ($this->option('delay-ms') ?? config('billing.vtb.reconcile.delay_ms', 1000))) * 1000;
        $итог = [];
        $расхождения = 0;
        $ошибки = 0;
        $беззвёздочки = 0;
        $истёкшие = [];

        foreach ($платежи as $платёж) {
            if ($платёж->provider === 'yookassa') {
                $this->юkassa($yooKassa, $платёж, $итог, $беззвёздочки, $ошибки, $истёкшие);
                usleep($пауза);

                continue;
            }

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
            $состояние = VtbAcquiringClient::orderStatus($ответ);

            /*
             * Банк кода не назвал — не называем и мы.
             *
             * `fromVtbActionCode` отдаёт `unknown` при `null` и `none`
             * при нуле, а шаг в прежней версии ставился `bank` всему,
             * кроме истёкшего срока. То есть не-ответ записывался как
             * «банк отказал» — ровно та выдумка, против которой эта
             * команда и заведена. Хуже, что после записи `failure_code`
             * перестаёт быть пустым, и выборка строку больше не берёт:
             * ошибка становится окончательной. Найдено ревью 02.10.
             *
             * Поэтому такие строки печатаются человеку и остаются как
             * были — переспросить их можно будет завтра.
             */
            if ($код === null || $код === 0) {
                $беззвёздочки++;
                $this->line(sprintf(
                    '  %s  orderStatus=%s actionCode=%s — банк причины не назвал, строка не тронута',
                    mb_substr((string) $платёж->uuid, 0, 8),
                    $состояние ?? '—',
                    $код === null ? '(нет)' : '0',
                ));
                usleep($пауза);

                continue;
            }

            $наш = PaymentFailure::fromVtbActionCode($код);
            $шаг = $наш === 'expired' ? PaymentFailure::STAGE_FORM : PaymentFailure::STAGE_BANK;

            /*
             * Число банка хранится рядом со словом. Таблица соответствий
             * против живого мерчанта не проверена, а прогон одноразовый:
             * ошибись она — переспросить будет нечем. С числом в строке
             * разбор можно пересобрать, не трогая банк.
             */
            $сообщение = $текст !== null
                ? mb_substr($текст, 0, 460).' [actionCode '.$код.']'
                : 'actionCode '.$код;

            $платёж->forceFill([
                'failure_code' => $наш,
                'failure_message' => $сообщение,
                'failure_stage' => $шаг,
            ])->save();

            $this->line(sprintf(
                '  %s  orderStatus=%s actionCode=%-6s → %s (%s)',
                mb_substr((string) $платёж->uuid, 0, 8),
                $состояние ?? '—',
                $код,
                $наш,
                PaymentFailure::stageLabels()[$шаг] ?? $шаг,
            ));

            if ($наш === 'expired') {
                $истёкшие[] = mb_substr((string) $платёж->uuid, 0, 8);
            }

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
        if ($беззвёздочки > 0) {
            $this->warn('Банк не назвал причину по '.$беззвёздочки.' заказам — строки не тронуты.');
        }
        if ($истёкшие !== []) {
            /*
             * «Срок истёк» значит, что человек ушёл с формы, а статус
             * остался `failed`: решение команда не пересматривает. В
             * воронке такая строка попадёт в «Отказано», а в разбивке по
             * шагам — в «открыл форму, не заплатил», и два графика
             * разойдутся. Поэтому список печатается: перенос в
             * `abandoned` — решение про деньги, его принимают руками.
             */
            $this->warn(
                'Срок заказа истёк, но статус остался «отказ» у '.count($истёкшие).' платежей: '
                .implode(', ', $истёкшие).'. В воронке они попадут в «Отказано» — перенесите в «брошено», если нужно.'
            );
        }

        /*
         * Пересчёт по базе независимым запросом: считать по тому же
         * счётчику, что накапливала запись, — значит проверить сложение,
         * а не результат.
         */
        $осталось = DB::table('payments')
            ->whereIn('provider', ['vtb', 'yookassa'])
            ->whereIn('status', ['failed', 'abandoned'])
            ->whereNull('failure_code')
            ->whereNotNull('provider_payment_id')
            ->count();
        $this->line('Осталось без причины в базе: '.$осталось);

        return self::SUCCESS;
    }
}
