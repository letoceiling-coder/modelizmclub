<?php

namespace Modules\Billing\Services;

use App\Models\Payment;
use App\Models\User;
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

        $есть = $this->points->balance($user);
        if ($есть < $points) {
            throw InsufficientPointsException::shortBy($points - $есть, $есть);
        }

        return DB::transaction(function () use ($user, $points, $type, $description, $metadata): Payment {
            $payment = Payment::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                // Ноль рублей — см. докблок. Баллы лежат в metadata.
                'amount_cents' => 0,
                'currency' => config('billing.currency', 'RUB'),
                'status' => 'paid',
                'provider' => 'points',
                'paid_at' => now(),
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
}
