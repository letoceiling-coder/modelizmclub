<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Billing\Exceptions\InsufficientPointsException;

/**
 * Оплата баллами — тем же путём, что и кошельком.
 *
 * Устроено по образцу `WalletPaymentService`: строка `payments`, списание,
 * и та же выдача (`PaymentFulfillmentService`). Отдельный путь выдачи
 * означал бы, что размещение, купленное баллами, появляется не так, как
 * купленное деньгами, — и расходиться они начали бы с первой же правки.
 *
 * СУММА В СТРОКЕ — НОЛЬ, И ЭТО ГЛАВНОЕ. Записать сюда рублёвую цену было
 * бы удобно для истории и разрушительно для бухгалтерии: выручка выросла
 * бы на деньги, которых никто не платил. Сегодня уже дважды чинили ровно
 * это — комиссию по разделённым сделкам и письмо о сделке. Поэтому
 * `amount_cents = 0`, а сколько баллов ушло, записано в `metadata`.
 *
 * ДВА НАЖАТИЯ — ОДНА ПОКУПКА. Ключ попытки кладётся в ту же колонку
 * `payments.idempotency_key`, что и у оплаты картой, и та же уникальность
 * его и стережёт. Без этого повтор запроса — второе нажатие, ретрай после
 * таймаута — списал бы баллы дважды и выдал бы продвижение на двойной
 * срок. У оплаты с кошелька этот пробел есть до сих пор; тиражировать его
 * на баллы незачем.
 *
 * НЕ ХВАТАЕТ — ОТКАЗ ЦЕЛИКОМ. Частичной оплаты нет: доплата деньгами
 * превратила бы одну покупку в две разные проводки с разными исходами, и
 * откатывать половину было бы нечем. Вместо этого человеку называют,
 * сколько баллов не хватает.
 */
class BonusPointsPaymentService
{
    public function __construct(
        private readonly BonusPointsService $points,
        private readonly PaymentFulfillmentService $fulfillment,
    ) {}

    /**
     * @param  array<string, mixed>  $metadata
     *
     * @throws InsufficientPointsException
     */
    public function pay(User $user, int $points, string $type, string $description, array $metadata): Payment
    {
        if ($points <= 0) {
            throw new InsufficientPointsException('Этот способ оплаты сейчас недоступен.');
        }

        $ключ = $metadata['idempotency_key'] ?? null;
        $ключ = is_string($ключ) && $ключ !== '' ? $ключ : null;

        // Уже платили по этому ключу — отдаём ту же покупку, а не вторую.
        if ($ключ !== null && ($прежний = $this->byKey($user, $ключ)) !== null) {
            return $прежний;
        }

        $есть = $this->points->balance($user);
        if ($есть < $points) {
            throw InsufficientPointsException::shortBy($points - $есть, $есть);
        }

        try {
            return $this->charge($user, $points, $type, $description, $metadata, $ключ);
        } catch (UniqueConstraintViolationException $e) {
            /*
             * Два запроса шли одновременно, проверку выше прошли оба, и
             * вставили оба — второму ответил уникальный индекс. Отдаём
             * строку соседа: с точки зрения нажавшего покупка одна, чего
             * он и ждёт. Баллы при этом списал только первый: вставка и
             * списание в одной транзакции, и откат унёс оба.
             */
            $прежний = $ключ !== null ? $this->byKey($user, $ключ) : null;

            if ($прежний !== null) {
                return $прежний;
            }

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $metadata
     *
     * @throws InsufficientPointsException
     */
    private function charge(User $user, int $points, string $type, string $description, array $metadata, ?string $ключ): Payment
    {
        return DB::transaction(function () use ($user, $points, $type, $description, $metadata, $ключ): Payment {
            $payment = Payment::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                // Ноль рублей — см. докблок. Баллы лежат в metadata.
                'amount_cents' => 0,
                'currency' => config('billing.currency', 'RUB'),
                'status' => 'paid',
                'provider' => 'points',
                'paid_at' => now(),
                'idempotency_key' => $ключ,
                'metadata' => array_merge($metadata, ['points_spent' => $points]),
            ]);

            /*
             * Списание под замком счёта внутри `debit`. Оно может вернуть
             * null — если между проверкой остатка выше и этой строкой баллы
             * успели уйти на другую покупку. Тогда вся сделка откатывается:
             * строка `payments` не остаётся, выдача не происходит.
             */
            $проводка = $this->points->debit($user, $points, $type, $description);

            if ($проводка === null) {
                throw InsufficientPointsException::shortBy($points - $this->points->balance($user), $this->points->balance($user));
            }

            $this->fulfillment->dispatchFulfillment($payment);

            return $payment;
        });
    }

    private function byKey(User $user, string $ключ): ?Payment
    {
        return Payment::query()
            ->where('idempotency_key', $ключ)
            ->where('user_id', $user->id)
            ->first();
    }
}
