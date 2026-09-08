<?php

namespace App\Console\Commands;

use App\Models\Payment;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Modules\Billing\Clients\VtbAcquiringClient;
use Modules\Billing\Services\PaymentFulfillmentService;
use Throwable;

/**
 * Разбор висящих `pending` платежей по ответу банка.
 *
 * На проде их 44, старейший от 19.07. Часть — след того, что каждое нажатие
 * «Оплатить» слало новый ключ идемпотентности и открывало новый заказ в
 * банке; часть — брошенные оплаты, где человек закрыл платёжную страницу.
 * Различить их по базе нельзя: строка выглядит одинаково.
 *
 * Поэтому команда ничего не решает сама, а спрашивает у банка про каждый
 * заказ. Удалять вслепую здесь нельзя вдвойне: под `pending` может лежать
 * оплаченный заказ, о котором потерялось уведомление, — а это выданная и
 * неучтённая подписка или неначисленное пополнение.
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
        {--limit=0 : ограничить число разбираемых платежей}';

    protected $description = 'Опросить банк по висящим pending-платежам и привести их статус в соответствие';

    /** Оплачен: банк подтвердил списание или удержание. */
    private const PAID = 'оплачен банком';

    /** Отклонён, отменён или возвращён — orderStatus 3, 4, 6. */
    private const CANCELLED = 'отменён банком';

    /** Заказ создан, но человек не довёл оплату: orderStatus 0. */
    private const ABANDONED = 'заказ открыт, оплата не начата';

    /** Заказа с таким номером у банка нет. */
    private const UNKNOWN = 'банк не знает такого заказа';

    /** Заказ вообще не создавался: пустой provider_payment_id. */
    private const NEVER_SENT = 'до банка не дошёл';

    /** Опрос не удался — сеть, доступы, неожиданный ответ. */
    private const FAILED_TO_ASK = 'опросить не удалось';

    public function handle(VtbAcquiringClient $client, PaymentFulfillmentService $fulfillment): int
    {
        $apply = (bool) $this->option('apply');
        $olderThan = max(0, (int) $this->option('older-than'));
        $limit = max(0, (int) $this->option('limit'));

        $query = Payment::query()
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($olderThan))
            ->orderBy('created_at');

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
            '%s: %d платёж(ей) в pending старше %d мин.',
            $apply ? 'Разбор с записью' : 'Разбор без записи (добавьте --apply)',
            $pending->count(),
            $olderThan,
        ));
        $this->newLine();

        /** @var array<string, list<Payment>> $buckets */
        $buckets = [];

        foreach ($pending as $payment) {
            $verdict = $this->askBank($client, $payment);
            $buckets[$verdict][] = $payment;

            $this->line(sprintf(
                '  %s  %s  %s  %s',
                str_pad($payment->uuid, 38),
                str_pad((string) $payment->created_at?->format('d.m H:i'), 12),
                str_pad(number_format($payment->amount_cents / 100, 2, ',', ' ').' ₽', 12, ' ', STR_PAD_LEFT),
                $verdict,
            ));

            if ($apply) {
                $this->applyVerdict($fulfillment, $payment, $verdict);
            }
        }

        $this->newLine();
        $this->table(
            ['Что сказал банк', 'Платежей', 'Сумма, ₽'],
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
     * Что банк думает про этот заказ.
     *
     * `getOrderStatusExtended` бросает исключение на любой ненулевой
     * `errorCode`, включая «заказ не найден» (код 6). Отличить незнание банка
     * от сбоя опроса можно только по тексту — отдельного типа исключения у
     * клиента нет. Поэтому неизвестные ошибки идут в свою корзину, а не
     * подшиваются к «банк не знает»: молча похоронить оплаченный заказ
     * из-за оборванной сети — ровно то, чего команда должна избегать.
     */
    private function askBank(VtbAcquiringClient $client, Payment $payment): string
    {
        $orderId = (string) ($payment->provider_payment_id ?? '');

        if ($orderId === '') {
            return self::NEVER_SENT;
        }

        try {
            $status = $client->getOrderStatusExtended($orderId);
        } catch (Throwable $e) {
            $message = $e->getMessage();

            if (str_contains($message, 'code 6') || str_contains(mb_strtolower($message), 'not found')) {
                return self::UNKNOWN;
            }

            $this->warn("    опрос {$orderId}: {$message}");

            return self::FAILED_TO_ASK;
        }

        if (VtbAcquiringClient::isPaidStatus($status)) {
            return self::PAID;
        }

        return match (VtbAcquiringClient::orderStatus($status)) {
            3, 4, 6 => self::CANCELLED,
            default => self::ABANDONED,
        };
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
            // Открытый заказ и неудавшийся опрос не трогаем: первый человек
            // ещё может оплатить, про второй мы просто ничего не знаем.
            default => null,
        };
    }

    /**
     * Проверка с другой стороны.
     *
     * Считать итог тем же условием, каким шла правка, бессмысленно: сломанное
     * условие сломано в обеих половинах одинаково. Поэтому пересчитываем по
     * факту в базе — сколько строк из разобранных всё ещё `pending`, — и
     * сверяем с числом тех, кого решено было не трогать.
     *
     * @param  Collection<int, Payment>  $pending
     */
    private function verifyIndependently(Collection $pending): void
    {
        $ids = $pending->pluck('id')->all();
        $stillPending = Payment::query()->whereIn('id', $ids)->where('status', 'pending')->count();
        $untouched = $pending->count() - Payment::query()
            ->whereIn('id', $ids)
            ->whereIn('status', ['paid', 'failed'])
            ->count();

        $this->newLine();
        $this->line("Осталось в pending: {$stillPending} из {$pending->count()}.");

        if ($stillPending !== $untouched) {
            $this->error(
                "Расхождение: не тронуто {$untouched}, а в pending {$stillPending}. ".
                'Разберитесь до следующего запуска.',
            );
        }
    }
}
