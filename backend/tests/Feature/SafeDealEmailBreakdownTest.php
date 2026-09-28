<?php

namespace Tests\Feature;

use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Notifications\SafeDealStatusNotification;
use Tests\TestCase;

/**
 * Письмо о сделке называет каждой стороне её число.
 *
 * ЧТО БЫЛО НЕ ТАК. Письмо одно на обе стороны, и в нём одна строка —
 * «Сумма сделки: X ₽» из `amount_kopecks`. После 27.09 это итог
 * покупателя: товар + комиссия + доставка. Продавцу приходило письмо
 * «Сумма сделки: 1 400 ₽», а на баланс он получал 1 000 ₽.
 *
 * Формально письмо не врало — оно и не обещало выплату. Но число,
 * названное продавцу в письме о его сделке, он прочитает как свою
 * выручку, и разницу в 400 ₽ объяснить будет нечем.
 *
 * Проверки построены так, чтобы падать на прежнем коде: они требуют
 * не «есть ли сумма», а «то ли это число и та ли подпись».
 */
class SafeDealEmailBreakdownTest extends TestCase
{
    use RefreshDatabase;

    /** @param array<string, mixed> $поля */
    private function сделка(array $поля = []): SafeDeal
    {
        $buyer = User::factory()->create(['email' => 'buyer'.Str::random(5).'@example.com']);
        $seller = User::factory()->create(['email' => 'seller'.Str::random(5).'@example.com']);

        return SafeDeal::query()->create(array_merge([
            'uuid' => (string) Str::uuid(),
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'status' => SafeDealStatus::Paid,
            'item_kopecks' => 100000,          // товар 1 000 ₽
            'platform_fee_kopecks' => 5000,    // комиссия 50 ₽
            'delivery_cost_kopecks' => 35000,  // доставка 350 ₽
            'amount_kopecks' => 140000,        // покупатель платит 1 400 ₽
            'seller_payout_kopecks' => 100000, // продавцу 1 000 ₽
            'fee_payer' => SafeDealFeePayer::Buyer,
        ], $поля));
    }

    /** @return list<string> строки письма, как их увидит человек */
    private function строки(SafeDeal $deal, User $кому): array
    {
        $mail = (new SafeDealStatusNotification($deal->loadMissing('listing'), 'Оплачено', ''))
            ->toMail($кому);

        return array_map(
            fn ($line) => is_string($line) ? $line : (string) $line,
            [...$mail->introLines, ...$mail->outroLines],
        );
    }

    public function test_the_buyer_sees_the_breakdown_and_his_own_total(): void
    {
        $deal = $this->сделка();
        $строки = implode(' | ', $this->строки($deal, $deal->buyer));

        $this->assertStringContainsString('Товар: 1 000,00 ₽', $строки);
        $this->assertStringContainsString('Комиссия', $строки);
        $this->assertStringContainsString('50,00 ₽', $строки);
        $this->assertStringContainsString('Доставка: 350,00 ₽', $строки);
        $this->assertStringContainsString('К оплате: 1 400,00 ₽', $строки);
    }

    public function test_the_seller_sees_what_he_will_be_paid_and_not_the_buyers_total(): void
    {
        $deal = $this->сделка();
        $строки = implode(' | ', $this->строки($deal, $deal->seller));

        $this->assertStringContainsString('К выплате: 1 000,00 ₽', $строки);

        /*
         * Главное утверждение: итога покупателя в письме продавцу нет.
         * Именно эта строка падает на прежнем коде — там стояло
         * «Сумма сделки: 1 400,00 ₽» независимо от получателя.
         */
        $this->assertStringNotContainsString('1 400,00 ₽', $строки);
    }

    public function test_the_seller_is_told_the_commission_is_not_taken_from_him(): void
    {
        $deal = $this->сделка();
        $строки = implode(' | ', $this->строки($deal, $deal->seller));

        // Продавцу важно не «сколько комиссия», а «с меня её не берут».
        $this->assertStringContainsString('комиссию оплатил покупатель', mb_strtolower($строки));
    }

    public function test_an_old_deal_still_tells_the_seller_the_commission_was_withheld(): void
    {
        /*
         * Сделки до 27.09 не пересчитывались: у них комиссия вычтена из
         * выплаты. Написать такому продавцу «комиссию оплатил покупатель»
         * значило бы соврать про уже закрытые деньги.
         */
        $deal = $this->сделка([
            'amount_kopecks' => 100000,
            'seller_payout_kopecks' => 95000,
            'delivery_cost_kopecks' => 0,
            'fee_payer' => SafeDealFeePayer::Seller,
        ]);

        $строки = mb_strtolower(implode(' | ', $this->строки($deal, $deal->seller)));

        $this->assertStringContainsString('удержана из выплаты', $строки);
        $this->assertStringNotContainsString('комиссию оплатил покупатель', $строки);
    }

    public function test_delivery_line_is_absent_when_there_is_no_delivery(): void
    {
        // Ноль рублей за доставку и отсутствие доставки — разные вещи.
        // «Доставка: 0,00 ₽» при самовывозе читается как несуществующая услуга.
        $deal = $this->сделка(['delivery_cost_kopecks' => 0, 'amount_kopecks' => 105000]);
        $строки = implode(' | ', $this->строки($deal, $deal->buyer));

        $this->assertStringNotContainsString('Доставка:', $строки);
        $this->assertStringContainsString('К оплате: 1 050,00 ₽', $строки);
    }

    public function test_a_stranger_gets_the_neutral_wording(): void
    {
        /*
         * Письмо шлют участникам, но получатель приходит извне метода, и
         * молча выдать чужому человеку число одной из сторон нельзя.
         * Обратный случай должен быть описан, а не подразумеваться.
         */
        $deal = $this->сделка();
        $чужой = User::factory()->create();

        $строки = implode(' | ', $this->строки($deal, $чужой));

        $this->assertStringContainsString('Сумма сделки: 1 400,00 ₽', $строки);
        $this->assertStringNotContainsString('К выплате', $строки);
    }

    // ------------------------------------------------------------------
    // Исход сделки: отмена и разделение суммы в споре
    // ------------------------------------------------------------------

    public function test_a_cancelled_deal_promises_the_seller_nothing(): void
    {
        /*
         * Находка ревью. Первая версия этой правки брала
         * `seller_payout_kopecks` всегда, и продавец получал письмо
         * «Сделка отменена» со строкой «К выплате: 1 000 ₽» — обещание
         * денег, которых не будет.
         */
        $deal = $this->сделка(['status' => SafeDealStatus::Cancelled]);
        $строки = implode(' | ', $this->строки($deal, $deal->seller));

        $this->assertStringNotContainsString('К выплате', $строки);
        $this->assertStringNotContainsString('1 000,00 ₽', $строки);
        $this->assertStringContainsString('Выплаты по этой сделке не будет', $строки);
    }

    public function test_a_cancelled_deal_tells_the_buyer_the_money_came_back(): void
    {
        $deal = $this->сделка(['status' => SafeDealStatus::Cancelled]);
        $строки = implode(' | ', $this->строки($deal, $deal->buyer));

        $this->assertStringContainsString('Возвращено: 1 400,00 ₽', $строки);
        $this->assertStringContainsString('Комиссия возвращена вместе с суммой', $строки);
        // «К оплате» на отменённой сделке — обещание платежа, которого нет.
        $this->assertStringNotContainsString('К оплате', $строки);
    }

    public function test_a_split_uses_the_amounts_actually_paid_out(): void
    {
        /*
         * Вторая находка ревью, и она про неверные числа, а не про
         * формулировку: `splitPayout` не обновляет `seller_payout_kopecks`
         * и `amount_kopecks`, фактические доли лежат в `metadata.split`.
         * Здесь продавцу зачислено 500 ₽ при плане 1 000 ₽.
         */
        $deal = $this->сделка([
            'status' => SafeDealStatus::Completed,
            'metadata' => ['split' => [
                'buyer_kopecks' => 90000,   // 900 ₽ обратно покупателю
                'seller_kopecks' => 50000,  // 500 ₽ продавцу
                'fee_returned_kopecks' => 5000,
            ]],
        ]);

        $продавцу = implode(' | ', $this->строки($deal, $deal->seller));
        $this->assertStringContainsString('Выплачено: 500,00 ₽', $продавцу);
        $this->assertStringNotContainsString('1 000,00 ₽', $продавцу);

        $покупателю = implode(' | ', $this->строки($deal, $deal->buyer));
        $this->assertStringContainsString('Возвращено: 900,00 ₽', $покупателю);
        $this->assertStringNotContainsString('1 400,00 ₽', $покупателю);
    }

    public function test_a_split_entirely_for_the_buyer_says_so_plainly(): void
    {
        $deal = $this->сделка([
            'status' => SafeDealStatus::Refunded,
            'metadata' => ['split' => [
                'buyer_kopecks' => 140000,
                'seller_kopecks' => 0,
                'fee_returned_kopecks' => 5000,
            ]],
        ]);

        $строки = implode(' | ', $this->строки($deal, $deal->seller));

        $this->assertStringContainsString('Выплаты по этой сделке нет', $строки);
        $this->assertStringNotContainsString('полную стоимость товара', $строки);
    }

    public function test_a_completed_deal_speaks_in_the_past_tense(): void
    {
        // «К оплате» и «К выплате» на завершённой сделке звучат как
        // ожидание, хотя деньги уже прошли.
        $deal = $this->сделка(['status' => SafeDealStatus::Completed]);

        $this->assertStringContainsString('Оплачено: 1 400,00 ₽', implode(' | ', $this->строки($deal, $deal->buyer)));
        $this->assertStringContainsString('Выплачено: 1 000,00 ₽', implode(' | ', $this->строки($deal, $deal->seller)));
    }

    public function test_a_split_entirely_for_the_seller_says_so_plainly(): void
    {
        // Зеркало предыдущего: доля покупателя ноль. Админская ручка
        // разрешения спора принимает `buyer_kopecks = 0`, так что случай
        // не гипотетический.
        $deal = $this->сделка([
            'status' => SafeDealStatus::Completed,
            'metadata' => ['split' => ['buyer_kopecks' => 0, 'seller_kopecks' => 135000]],
        ]);

        $строки = implode(' | ', $this->строки($deal, $deal->buyer));

        $this->assertStringContainsString('Возврата по этой сделке нет', $строки);
        $this->assertStringNotContainsString('0,00 ₽', $строки);
    }

    public function test_an_old_deal_cancelled_still_says_nothing_about_a_payout(): void
    {
        /*
         * Комбинация, которой не хватало: старая схема (комиссия
         * удержана у продавца) плюс терминальный статус. Гейты по
         * комиссии и по исходу независимы, и проверка закрепляет, что
         * они не конфликтуют.
         */
        $deal = $this->сделка([
            'status' => SafeDealStatus::Cancelled,
            'fee_payer' => SafeDealFeePayer::Seller,
            'amount_kopecks' => 100000,
            'seller_payout_kopecks' => 95000,
            'delivery_cost_kopecks' => 0,
        ]);

        $продавцу = implode(' | ', $this->строки($deal, $deal->seller));
        $this->assertStringContainsString('Выплаты по этой сделке не будет', $продавцу);
        $this->assertStringNotContainsString('удержана из выплаты', $продавцу);
        $this->assertStringNotContainsString('950,00 ₽', $продавцу);

        // Покупателю про комиссию не говорим: по старой схеме он её не платил.
        $покупателю = implode(' | ', $this->строки($deal, $deal->buyer));
        $this->assertStringContainsString('Возвращено: 1 000,00 ₽', $покупателю);
        $this->assertStringNotContainsString('Комиссия возвращена', $покупателю);
    }

    public function test_broken_split_metadata_falls_back_to_the_plan_without_crashing(): void
    {
        /*
         * Если `splitPayout` однажды уронит ключ, разбор не должен ни
         * падать, ни молча показывать ноль. Ожидание — откат к плану,
         * закреплённый проверкой, а не подразумеваемый.
         */
        foreach ([null, [], ['split' => 'не массив'], ['split' => ['buyer_kopecks' => 1]]] as $мусор) {
            $deal = $this->сделка(['metadata' => $мусор]);
            $строки = implode(' | ', $this->строки($deal, $deal->seller));

            $this->assertStringContainsString('К выплате: 1 000,00 ₽', $строки);
        }
    }
}
