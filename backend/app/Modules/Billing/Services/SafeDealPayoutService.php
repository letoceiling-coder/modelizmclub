<?php

namespace Modules\Billing\Services;

use App\Enums\SafeDealGatewayContour;
use App\Enums\SafeDealPayoutChannel;
use App\Enums\SafeDealPayoutStatus;
use App\Models\SafeDeal;
use App\Models\SafeDealGatewayEvent;
use App\Models\SafeDealPayout;
use App\Models\UserPayoutRequisites;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Billing\Clients\VtbSbpPayoutClient;
use Throwable;

/**
 * Seller payout for a completed deal, over VTB SBP B2C (ОЭ).
 *
 * The bank flow is asynchronous: `check_accept_transaction` returns
 * NEW/PROCESSING, the payout becomes APPROVED via callback or polling, and only
 * then may we `confirm_transaction`. Sellers without SBP requisites keep the
 * wallet credit that {@see SafeDealService} writes, and withdraw manually.
 */
class SafeDealPayoutService
{
    public function __construct(private readonly VtbSbpPayoutClient $client) {}

    public function enabled(): bool
    {
        return (bool) config('billing.vtb_payout.enabled')
            && config('billing.vtb_payout.client_id')
            && config('billing.vtb_payout.client_secret');
    }

    /**
     * Starts an SBP payout for a completed deal.
     *
     * @return SafeDealPayout|null Null when payouts are off or the seller has no SBP requisites.
     */
    public function start(SafeDeal $deal): ?SafeDealPayout
    {
        if (! $this->enabled()) {
            return null;
        }

        $existing = SafeDealPayout::query()
            ->where('safe_deal_id', $deal->id)
            ->whereNotIn('status', [SafeDealPayoutStatus::Declined])
            ->latest('id')
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $requisites = UserPayoutRequisites::query()->find($deal->seller_id);
        $phone = $requisites?->sbp_phone;
        $bankId = $requisites?->sbp_bank_id;
        $fullName = $requisites?->sbp_full_name;

        if (! $phone || ! $bankId || ! $fullName) {
            Log::info('SafeDeal payout: seller has no SBP requisites, keeping wallet credit', [
                'deal' => $deal->uuid,
                'seller' => $deal->seller_id,
            ]);

            return null;
        }

        $payout = SafeDealPayout::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'seller_id' => $deal->seller_id,
            'channel' => SafeDealPayoutChannel::Sbp,
            'status' => SafeDealPayoutStatus::Created,
            'amount_kopecks' => (int) $deal->seller_payout_kopecks,
            'commission_kopecks' => (int) $deal->platform_fee_kopecks,
            'currency' => $deal->currency ?? 'RUB',
            'request_id' => (string) Str::uuid(),
            'payment_purpose' => "Выплата по сделке {$deal->uuid}",
            'sbp_phone' => $phone,
            'sbp_bank_id' => $bankId,
            'sbp_full_name' => $fullName,
        ]);

        try {
            $response = $this->client->checkAcceptTransaction(
                $payout->request_id,
                $phone,
                (int) $payout->amount_kopecks,
                $bankId,
                $fullName,
                $payout->payment_purpose,
            );
        } catch (Throwable $e) {
            $payout->update([
                'status' => SafeDealPayoutStatus::Declined,
                'decline_reason' => $e->getMessage(),
                'declined_at' => now(),
            ]);

            Log::error('SafeDeal payout: check_accept_transaction failed', [
                'deal' => $deal->uuid,
                'exception' => $e->getMessage(),
            ]);

            return $payout->fresh();
        }

        /*
         * План блока считал, что здесь одна запись и транзакция не нужна.
         * Записей три: создание строки выплаты, журнал ответа банка и
         * применение статуса, — и между первой и второй стоит обращение к
         * банку. Проверено чтением, а не предположением.
         *
         * Строка создаётся до банка намеренно, как и у входящего платежа:
         * `request_id` из неё уходит в запрос, и без строки выплату потом не
         * найти. Две записи после ответа сведены в одну транзакцию.
         */
        $this->recordBankReply($payout, 'payout.requested', $response);

        return $payout->fresh();
    }

    /** Polls the bank and confirms as soon as the payout is APPROVED. */
    public function advance(SafeDealPayout $payout): SafeDealPayout
    {
        if ($payout->status->isTerminal() || ! $payout->request_id) {
            return $payout;
        }

        try {
            if ($payout->status->canConfirm()) {
                $confirm = $this->client->confirmTransaction($payout->request_id);
                $this->recordBankReply($payout, 'payout.confirmed', $confirm);

                return $payout->fresh();
            }

            $status = $this->client->statusTransaction($payout->request_id);
            $this->recordBankReply($payout, 'payout.status', $status);

            // A poll that lands on APPROVED can be confirmed straight away.
            $payout = $payout->fresh();
            if ($payout->status->canConfirm()) {
                $confirm = $this->client->confirmTransaction($payout->request_id);
                $this->recordBankReply($payout, 'payout.confirmed', $confirm);
            }
        } catch (Throwable $e) {
            Log::warning('SafeDeal payout: advance failed', [
                'payout' => $payout->uuid,
                'exception' => $e->getMessage(),
            ]);
        }

        return $payout->fresh();
    }

    /** @param array<string, mixed> $response */
    public function apply(SafeDealPayout $payout, array $response): void
    {
        $bankStatus = $response['status'] ?? $response['transactionStatus'] ?? $response['confirmStatus'] ?? null;
        $payout->applyBankStatus(is_string($bankStatus) ? $bankStatus : null);

        if (isset($response['operationId'])) {
            $payout->operation_id = (string) $response['operationId'];
        }

        if (isset($response['pam'])) {
            $payout->sbp_pam = (string) $response['pam'];
        }

        if (isset($response['nspkResponseCode'])) {
            $payout->nspk_response_code = (string) $response['nspkResponseCode'];
        }

        if (isset($response['nspkResponseMessage'])) {
            $payout->nspk_response_message = (string) $response['nspkResponseMessage'];
        }

        if ($payout->status === SafeDealPayoutStatus::Declined) {
            $payout->decline_reason ??= (string) ($response['message'] ?? $response['errorMessage'] ?? 'Отклонено банком');
        }

        $payout->save();
    }

    public function findByRequestId(string $requestId): ?SafeDealPayout
    {
        return SafeDealPayout::query()->where('request_id', $requestId)->first();
    }

    /** Payouts still waiting on the bank, oldest first. */
    public function pending(int $limit = 100): \Illuminate\Support\Collection
    {
        return SafeDealPayout::query()
            ->whereIn('status', [
                SafeDealPayoutStatus::Created,
                SafeDealPayoutStatus::Processing,
                SafeDealPayoutStatus::Approved,
                SafeDealPayoutStatus::Confirmed,
            ])
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    /**
     * Ответ банка — в журнал и в строку выплаты одной транзакцией.
     *
     * Порознь они означали бы, что упавший процесс оставляет либо запись о
     * событии без изменения статуса, либо статус без следа, откуда он взялся.
     * Второе хуже: выплатной контур разбирается по журналу событий, и статус
     * без события — это выплата, о происхождении которой сказать нечего.
     *
     * Обращение к банку остаётся снаружи: сеть не держит блокировку строки.
     *
     * @param array<string, mixed> $response
     */
    private function recordBankReply(SafeDealPayout $payout, string $eventType, array $response): void
    {
        DB::transaction(function () use ($payout, $eventType, $response): void {
            $locked = SafeDealPayout::query()
                ->whereKey($payout->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $this->journal($locked, $eventType, $response);
            $this->apply($locked, $response);
        });
    }

    /**
     * @param array<string, mixed> $payload
     *
     * Была обычная вставка с перехватом исключения. Ключ идемпотентности
     * собран из ответа банка, а опрос выплаты по расписанию получает один и
     * тот же ответ, пока банк думает, — то есть повтор здесь норма, и вставка
     * честно падала в `unique` на каждом втором опросе. Перехват это скрывал.
     *
     * Внутри транзакции такой отказ уже не скроешь: в PostgreSQL неудавшийся
     * оператор ломает всю транзакцию, и запись статуса откатилась бы вместе с
     * ним. `insertOrIgnore` разрешает конфликт внутри самого оператора и
     * неудачи не даёт — ценой ручного приведения типов и меток времени.
     */
    private function journal(SafeDealPayout $payout, string $eventType, array $payload): void
    {
        try {
            SafeDealGatewayEvent::query()->insertOrIgnore([
                'uuid' => (string) Str::uuid(),
                'contour' => SafeDealGatewayContour::Oe->value,
                'event_type' => $eventType,
                'safe_deal_id' => $payout->safe_deal_id,
                'payout_id' => $payout->id,
                'idempotency_key' => $eventType.':'.$payout->id.':'.md5(json_encode($payload) ?: ''),
                'payload' => json_encode($payload),
                'processed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $e) {
            Log::warning('SafeDeal payout: gateway event not journalled', [
                'payout' => $payout->id,
                'event' => $eventType,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
