<?php

namespace App\Console\Commands;

use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Clients\YooKassaClient;
use Modules\Billing\Exceptions\VtbApiException;
use Modules\Billing\Services\PaymentFulfillmentService;
use Throwable;

/**
 * Разбор висящих `pending` платежей.
 *
 * На проде их сорок семь, старейший от 19.07. Часть — след того, что каждое
 * нажатие «Оплатить» слало новый ключ идемпотентности и открывало новый
 * заказ; часть — брошенные оплаты. Различить их по базе нельзя: строка
 * выглядит одинаково.
 *
 * Поэтому команда ничего не решает сама, а выясняет про каждый платёж — и
 * выясняет по-разному, смотря кто его создал:
 *
 *   vtb  — спрашивает банк. Заказ там есть, и только банк знает, чем
 *          кончилось.
 *   yookassa — спрашивает ЮKassa. Живой интеграции в коде нет, но ключи
 *          магазина рабочие, и `GET /payments/{id}` отвечает.
 *   stub — тестовый контур, заказа в банке нет по определению. Спрашивать
 *          ВТБ про такой номер бессмысленно: 08.09 команда так и делала и
 *          получала «банк не знает» на каждый. Разбирается по внутренним
 *          следам исполнения: пополнению кошелька, размещению объявления.
 *
 * Удалять вслепую нельзя вдвойне: под `pending` может лежать оплаченный
 * заказ, о котором потерялось уведомление, — а это выданная и неучтённая
 * подписка или неначисленное пополнение.
 *
 * Без `--apply` только показывает разбор. Так и задумано: правило проекта
 * требует сперва `--dry-run`, а выборку проверять независимым запросом —
 * что команда и делает сама, пересчитывая итог по базе после записи.
 */
class ReconcilePendingPaymentsCommand extends Command
{
    protected $signature = 'payments:reconcile-pending
        {--apply : применить изменения; без флага только разбор}
        {--older-than=15 : не трогать платежи моложе этого числа минут}
        {--newer-than=0 : не трогать платежи старше этого числа минут (0 — без верхней границы)}
        {--provider= : разбирать только платежи этого провайдера (vtb, yookassa, stub)}
        {--limit=0 : ограничить число разбираемых платежей}
        {--only= : применять только к этим исходам, через запятую (см. --only=? )}
        {--delay-ms= : пауза между запросами к банку, мс (по умолчанию из billing.vtb.reconcile)}
        {--retries= : повторов при отказе по частоте (по умолчанию из billing.vtb.reconcile)}';

    protected $description = 'Разобрать висящие pending-платежи: ВТБ — опросом банка, тестовый контур — по внутренним следам';

    /** Банк подтвердил списание или удержание. */
    private const PAID = 'оплачен банком';

    /** Отклонён, отменён или возвращён — orderStatus 3, 4, 6. */
    private const CANCELLED = 'отменён банком';

    /** Заказ создан, но человек не довёл оплату: orderStatus 0. */
    private const ABANDONED = 'заказ открыт, оплата не начата';

    /** Заказа с таким номером у банка нет — errorCode 6. */
    private const UNKNOWN = 'банк не знает такого заказа';

    /** Заказ вообще не создавался: пустой provider_payment_id. */
    private const NEVER_SENT = 'до банка не дошёл';

    /** Опрос не удался — сеть, доступы, частота. Состояние осталось неизвестным. */
    private const FAILED_TO_ASK = 'опросить не удалось';

    /** Тестовый контур: следов исполнения нет, оплату не подтверждали. */
    private const STUB_ABANDONED = 'тестовый контур, оплата не подтверждена';

    /** Тестовый контур: исполнение состоялось, а статус отстал. */
    private const STUB_FULFILLED = 'тестовый контур, исполнен — статус отстал';

    /**
     * Платёж создан не тем и не другим — спросить некого.
     *
     * Раньше всё, что не `vtb`, попадало в ветку тестового контура. 08.09
     * выяснилось, что на проде есть третий провайдер: 27 платежей с меткой
     * `yookassa`, номера заказов боевого вида, ВТБ о них не знает. Они лежали
     * в корзине «тестовый контур, оплата не подтверждена», и `--apply` закрыл
     * бы их как неудавшиеся, не спросив никого.
     *
     * Отдельный исход, и он не закрывается никогда: `--only` его не
     * принимает, `applyVerdict` не знает.
     *
     * 10.09 ЮKassa из этого исхода вышла: ключи магазина оказались живыми,
     * и команда научилась её спрашивать ({@see askYooKassa}). Исход остался
     * — для провайдера, которого заведут завтра и опрашивать будет нечем.
     */
    private const UNKNOWN_PROVIDER = 'провайдер неизвестен, разбор невозможен';

    /**
     * Короткие имена исходов для `--only`.
     *
     * Разбор всегда идёт по всем платежам — иначе не узнать исход, — а
     * записывается только то, что названо. Нужно это затем, что исходы стоят
     * разного: тестовые и отменённые закрывать нечем рисковать, а по
     * оплаченным сначала надо понять, что человеку причитается. 08.09 такой
     * разбор показал, что один пользователь заплатил 1 097 ₽ тремя платежами
     * и не получил ничего; выдавать ему три подписки подряд командой было бы
     * хуже, чем не трогать.
     *
     * @var array<string, string>
     */
    private const ONLY_KEYS = [
        'paid' => self::PAID,
        'cancelled' => self::CANCELLED,
        'open' => self::ABANDONED,
        'unknown' => self::UNKNOWN,
        'never-sent' => self::NEVER_SENT,
        'failed' => self::FAILED_TO_ASK,
        'test' => self::STUB_ABANDONED,
        'test-fulfilled' => self::STUB_FULFILLED,
    ];

    public function handle(VtbAcquiringClient $client, YooKassaClient $yooKassa, PaymentFulfillmentService $fulfillment): int
    {
        $apply = (bool) $this->option('apply');
        $olderThan = max(0, (int) $this->option('older-than'));
        $newerThan = max(0, (int) $this->option('newer-than'));
        $limit = max(0, (int) $this->option('limit'));
        $provider = $this->option('provider') !== null && trim((string) $this->option('provider')) !== ''
            ? trim((string) $this->option('provider'))
            : null;

        $delayMs = $this->option('delay-ms') !== null
            ? max(0, (int) $this->option('delay-ms'))
            : (int) config('billing.vtb.reconcile.delay_ms', 1000);
        $retries = $this->option('retries') !== null
            ? max(0, (int) $this->option('retries'))
            : (int) config('billing.vtb.reconcile.max_retries', 3);
        $backoffMs = (int) config('billing.vtb.reconcile.backoff_ms', 2000);

        $only = $this->resolveOnly();

        if ($only === false) {
            return self::FAILURE;
        }

        $query = Payment::query()
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($olderThan))
            ->orderBy('created_at');

        /*
         * Верхняя граница окна. Нужна автоопросу: брошенные заказы банк
         * держит в статусе 0 бессрочно, и без неё каждый прогон по расписанию
         * заново опрашивал бы всё, что накопилось с июля, — упираясь в лимит
         * частоты раньше, чем дойдёт до сегодняшних оплат. Разбору руками
         * граница не нужна, поэтому по умолчанию её нет.
         */
        if ($newerThan > 0) {
            $query->where('created_at', '>=', now()->subMinutes($newerThan));
        }

        // Отбор по провайдеру: автоопрос ходит в банк и берёт только `vtb`.
        // Платежи тестового контура разбираются по внутренним следам, ждать
        // им нечего, и в прогоне по расписанию им делать нечего.
        if ($provider !== null) {
            $query->where('provider', $provider);
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        /** @var Collection<int, Payment> $pending */
        $pending = $query->get();

        if ($pending->isEmpty()) {
            $this->info('Висящих платежей нет.');

            return self::SUCCESS;
        }

        $this->line(sprintf(
            '%s: %d платёж(ей) в pending старше %d мин%s%s. Пауза между запросами к банку %d мс, повторов при 429 — %d.',
            $apply ? 'Разбор с записью' : 'Разбор без записи (добавьте --apply)',
            $pending->count(),
            $olderThan,
            $newerThan > 0 ? " и моложе {$newerThan} мин" : '',
            $provider !== null ? ", провайдер {$provider}" : '',
            $delayMs,
            $retries,
        ));

        if ($only !== null) {
            $this->line('Записываются только исходы: '.implode(', ', $only));
        }
        $this->newLine();

        /** @var array<string, list<Payment>> $buckets */
        $buckets = [];
        $asked = 0;

        foreach ($pending as $payment) {
            if ($payment->provider === 'vtb') {
                // Пауза только между обращениями к банку: платежи тестового
                // контура разбираются по базе и темп не расходуют.
                if ($asked > 0 && $delayMs > 0) {
                    usleep($delayMs * 1000);
                }
                $asked++;
                $verdict = $this->askBank($client, $payment, $retries, $backoffMs);
            } elseif ($payment->provider === 'yookassa') {
                if ($asked > 0 && $delayMs > 0) {
                    usleep($delayMs * 1000);
                }
                $asked++;
                $verdict = $this->askYooKassa($yooKassa, $payment);
            } elseif ($payment->provider === 'stub') {
                $verdict = $this->askOurselves($payment);
            } else {
                // Ни банк, ни внутренние следы тут не годятся: чей это
                // платёж и что с ним, команда не знает.
                $verdict = self::UNKNOWN_PROVIDER;
            }

            $buckets[$verdict][] = $payment;

            $selected = $only === null || in_array($verdict, $only, true);

            $this->line(sprintf(
                '  %s  %s  %s  %s  %s%s',
                str_pad($payment->uuid, 38),
                str_pad((string) $payment->created_at?->format('d.m H:i'), 12),
                str_pad(number_format($payment->amount_cents / 100, 2, ',', ' ').' ₽', 12, ' ', STR_PAD_LEFT),
                str_pad((string) $payment->provider, 5),
                $verdict,
                $only !== null && ! $selected ? '  — не в --only, оставлен' : '',
            ));

            if ($apply && $selected) {
                $this->applyVerdict($fulfillment, $payment, $verdict);
            }
        }

        $this->newLine();
        $this->table(
            ['Исход', 'Платежей', 'Сумма, ₽'],
            collect($buckets)->map(fn (array $rows, string $verdict): array => [
                $verdict,
                count($rows),
                number_format(array_sum(array_map(
                    static fn (Payment $p): int => (int) $p->amount_cents,
                    $rows,
                )) / 100, 2, ',', ' '),
            ])->values()->all(),
        );

        if (! $apply) {
            $this->newLine();
            $this->warn('Ничего не записано. Для применения: --apply');

            return self::SUCCESS;
        }

        $this->verifyIndependently($pending);

        return self::SUCCESS;
    }

    /**
     * Разбор `--only`: список исходов или null, если ключ не задан.
     *
     * Незнакомое имя — остановка, а не молчаливое «ничего не подошло».
     * Опечатка в ключе при `--apply` иначе выглядела бы как успешный прогон,
     * не тронувший ни строки, и это заметили бы не сразу.
     *
     * @return list<string>|null|false false — ключ разобрать не удалось
     */
    private function resolveOnly(): array|null|false
    {
        $raw = $this->option('only');

        if ($raw === null || trim((string) $raw) === '') {
            return null;
        }

        if (trim((string) $raw) === '?') {
            $this->line('Исходы для --only: '.implode(', ', array_keys(self::ONLY_KEYS)));

            return false;
        }

        $names = array_values(array_filter(array_map('trim', explode(',', (string) $raw))));
        $verdicts = [];

        foreach ($names as $name) {
            if (! array_key_exists($name, self::ONLY_KEYS)) {
                $this->error("Неизвестный исход в --only: {$name}");
                $this->line('Допустимые: '.implode(', ', array_keys(self::ONLY_KEYS)));

                return false;
            }

            $verdicts[] = self::ONLY_KEYS[$name];
        }

        return $verdicts;
    }

    /**
     * Что банк думает про этот заказ.
     *
     * Отказ по частоте — не ответ, а просьба подождать, поэтому на него
     * повторяем с нарастающей паузой. Всё остальное разбирается по причине из
     * исключения, а не по тексту сообщения: до 08.09 команда искала «code 6»
     * подстрокой и не отличала «банк не знает» от «банк не ответил».
     */
    private function askBank(VtbAcquiringClient $client, Payment $payment, int $retries, int $backoffMs): string
    {
        $orderId = (string) ($payment->provider_payment_id ?? '');

        if ($orderId === '') {
            return self::NEVER_SENT;
        }

        for ($attempt = 0; $attempt <= $retries; $attempt++) {
            try {
                $status = $client->getOrderStatusExtended($orderId);

                if (VtbAcquiringClient::isPaidStatus($status)) {
                    return self::PAID;
                }

                return match (VtbAcquiringClient::orderStatus($status)) {
                    3, 4, 6 => self::CANCELLED,
                    default => self::ABANDONED,
                };
            } catch (VtbApiException $e) {
                if ($e->isUnknownOrder()) {
                    return self::UNKNOWN;
                }

                if ($e->isRateLimited() && $attempt < $retries) {
                    $wait = $backoffMs * (2 ** $attempt);
                    $this->line("    частота превышена, ждём {$wait} мс и повторяем");
                    usleep($wait * 1000);

                    continue;
                }

                $this->warn("    опрос {$orderId}: {$e->getMessage()}");

                return self::FAILED_TO_ASK;
            } catch (Throwable $e) {
                $this->warn("    опрос {$orderId}: {$e->getMessage()}");

                return self::FAILED_TO_ASK;
            }
        }

        return self::FAILED_TO_ASK;
    }

    /**
     * Что ЮKassa думает про этот платёж.
     *
     * До 10.09 таких платежей команда не разбирала вовсе: 27 висящих
     * записей с меткой `yookassa` лежали в исходе «провайдер неизвестен»,
     * потому что живой интеграции в коде нет — YooKassa убрана в spec v4.0,
     * шлюза для неё не осталось. Уцелел `YooKassaClient` (им привязывают
     * карты) и ключи магазина в конфигурации, и 10.09 выяснилось, что ключи
     * живые: `GET /me` отвечает 200, магазин `enabled`, ИНН совпадает с
     * компанией. Значит, спросить было чем — просто никто не спрашивал.
     *
     * Соответствие статусов прямое:
     *
     *   succeeded            — деньги у магазина;
     *   canceled             — платёж отменён, денег нет;
     *   pending              — человек не довёл оплату, заказ ещё жив;
     *   waiting_for_capture  — деньги удержаны, но не списаны: трогать
     *                          нельзя, это решение о захвате, а не сверка.
     *
     * Отказ любого рода — «опросить не удалось», а не «нет такого заказа».
     * Клиент бросает одно исключение на все коды ответа, и отличить 404 от
     * пятисотки по тексту нельзя — а гадать здесь опаснее, чем оставить
     * платёж висеть: закрытый по ошибке `succeeded` — это неучтённая
     * подписка. Пока клиент не научится различать коды, ошибка молчит в
     * пользу платежа.
     */
    private function askYooKassa(YooKassaClient $client, Payment $payment): string
    {
        $paymentId = (string) ($payment->provider_payment_id ?? '');

        if ($paymentId === '') {
            return self::NEVER_SENT;
        }

        try {
            $data = $client->getPayment($paymentId);
        } catch (Throwable $e) {
            $this->warn("    опрос {$paymentId}: {$e->getMessage()}");

            return self::FAILED_TO_ASK;
        }

        return match ($data['status'] ?? null) {
            'succeeded' => self::PAID,
            'canceled' => self::CANCELLED,
            'pending', 'waiting_for_capture' => self::ABANDONED,
            default => self::FAILED_TO_ASK,
        };
    }

    /**
     * Платёж тестового контура: спрашивать некого, смотрим на свои следы.
     *
     * Исполнение оставляет запись: пополнение — проводку в кошельке с
     * `ref_type = payment` и `ref_id` платежа, размещение —
     * `listings.placement_payment_id`. Имена колонок выписаны по миграции, а
     * не по памяти: 07.09 счётчики комментариев обнулились ровно из-за
     * условия, которое не совпало ни с одной строкой и молча дало ноль. Если
     * след есть, а платёж висит в `pending`, разошлись статус и факт — такое
     * чинится руками, вслепую его трогать нельзя. Если следа нет, человек
     * просто не довёл оплату на тестовой странице.
     */
    private function askOurselves(Payment $payment): string
    {
        $fulfilled = DB::table('wallet_transactions')
            ->where('ref_type', 'payment')
            ->where('ref_id', $payment->id)
            ->exists()
            || DB::table('listings')
                ->where('placement_payment_id', $payment->id)
                ->exists();

        return $fulfilled ? self::STUB_FULFILLED : self::STUB_ABANDONED;
    }

    private function applyVerdict(PaymentFulfillmentService $fulfillment, Payment $payment, string $verdict): void
    {
        match ($verdict) {
            // Оплата состоялась, а уведомление потерялось: доводим до конца
            // тем же путём, что и колбэк, — подписка и пополнение выдаются
            // внутри markPaid.
            self::PAID => $fulfillment->markPaid($payment, (string) $payment->provider_payment_id),
            self::CANCELLED => $fulfillment->markFailed($payment, 'Сверка: банк сообщил об отмене заказа.'),
            self::UNKNOWN => $fulfillment->markFailed($payment, 'Сверка: заказа нет у банка.'),
            self::NEVER_SENT => $fulfillment->markFailed($payment, 'Сверка: заказ в банке не создавался.'),
            self::STUB_ABANDONED => $fulfillment->markFailed($payment, 'Сверка: тестовая оплата не подтверждена.'),
            /*
             * Не трогаем:
             *   открытый заказ  — человек ещё может вернуться и оплатить;
             *   неудавшийся опрос — мы просто не знаем состояния, и закрыть
             *     заказ здесь значило бы похоронить оплату из-за своего сбоя;
             *   расхождение в тестовом контуре — там исполнение уже случилось,
             *     и повторный markPaid выдал бы подписку второй раз.
             */
            default => null,
        };
    }

    /**
     * Проверка с другой стороны.
     *
     * Считать итог тем же условием, каким шла правка, бессмысленно: сломанное
     * условие сломано в обеих половинах одинаково. Поэтому пересчитываем по
     * факту в базе — по конечному статусу каждой разобранной строки — и
     * сверяем, что закрытые и оставшиеся дают ровно то число, с которого
     * начали. Разошлось — значит, кто-то поменял строки помимо команды.
     *
     * @param  Collection<int, Payment>  $pending
     */
    private function verifyIndependently(Collection $pending): void
    {
        $ids = $pending->pluck('id')->all();
        $stillPending = Payment::query()->whereIn('id', $ids)->where('status', 'pending')->count();
        $closed = Payment::query()->whereIn('id', $ids)->whereIn('status', ['paid', 'failed'])->count();
        $paid = Payment::query()->whereIn('id', $ids)->where('status', 'paid')->count();
        $failed = Payment::query()->whereIn('id', $ids)->where('status', 'failed')->count();

        $this->newLine();
        $this->line("Закрыто: {$closed} из {$pending->count()} (доведено до оплаты {$paid}, отмечено неудавшимися {$failed}).");
        $this->line("Осталось в pending: {$stillPending}.");

        if ($closed + $stillPending !== $pending->count()) {
            $this->error(
                'Расхождение: закрытые и оставшиеся не складываются в разобранные. '.
                'Разберитесь до следующего запуска.',
            );
        }
    }
}
