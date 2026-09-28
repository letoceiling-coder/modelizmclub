<?php

namespace Modules\Billing\Notifications;

use App\Enums\SafeDealFeePayer;
use App\Enums\SafeDealStatus;
use App\Models\SafeDeal;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Письмо о шаге сделки — по одному на каждое изменение статуса.
 *
 * ПОЧЕМУ РАЗБИВКА, А НЕ ОДНА СУММА. До 29.09 в письме стояла строка
 * «Сумма сделки: X ₽» из `amount_kopecks`, одинаковая для обеих сторон.
 * После 27.09 это итог покупателя — товар плюс комиссия плюс доставка.
 * Продавцу приходило «Сумма сделки: 1 400 ₽», а на баланс он получал
 * 1 000 ₽.
 *
 * Формально письмо не врало: выплату оно не обещало. Но число, названное
 * продавцу в письме о его сделке, он прочитает как свою выручку, и
 * разницу в четыреста рублей объяснить будет нечем. Поэтому каждой
 * стороне называется её число, а разбивка показывается целиком: из чего
 * сложился итог, видно без захода в кабинет.
 *
 * СТАРЫЕ СДЕЛКИ ЗВУЧАТ ПО-СТАРОМУ. У сделок до 27.09 комиссия вычтена из
 * выплаты, и писать их продавцу «комиссию оплатил покупатель» значило бы
 * соврать про уже закрытые деньги. Различие берётся из строки
 * (`fee_payer`), а не из даты — по той же причине, по какой оно так
 * заведено в расчётах.
 *
 * ЧИСЛА ЗАВИСЯТ ОТ ИСХОДА, А НЕ ОТ ПЛАНА. Первая версия этой правки
 * брала `seller_payout_kopecks` всегда — и письмо об отменённой сделке
 * обещало продавцу выплату, которой не будет. Хуже: при разделении
 * суммы в споре `seller_payout_kopecks` и `amount_kopecks` вообще не
 * обновляются (`SafeDealService::splitPayout` пишет фактические доли в
 * `metadata.split`), так что план и факт расходятся на любую долю.
 *
 * Поэтому сперва определяется исход — возврат, разделение или обычный
 * ход, — и только потом берутся числа: при разделении из `metadata.split`,
 * при возврате говорится о возврате, в остальных случаях план и есть факт.
 *
 * ЧУЖОМУ — НЕЙТРАЛЬНО. Письмо шлют участникам, но получатель приходит
 * в метод извне, и если он не покупатель и не продавец, число одной из
 * сторон ему не показывается: остаётся общая сумма сделки.
 */
class SafeDealStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly SafeDeal $deal,
        private readonly string $title,
        private readonly string $body,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/deals/'.$this->deal->uuid;
        $listing = $this->deal->listing?->title;

        $mail = (new MailMessage)
            ->subject($this->title.' — Modelizm Club')
            ->greeting('Здравствуйте!')
            ->line($this->title.'.');

        if ($listing) {
            $mail->line('Объявление: '.$listing);
        }

        foreach ($this->разбивка($notifiable) as $строка) {
            $mail->line($строка);
        }

        if ($this->body !== '') {
            $mail->line($this->body);
        }

        return $mail
            ->action('Открыть сделку', $url)
            ->line('Статус и историю сделки всегда видно в личном кабинете.');
    }

    /**
     * Строки о деньгах — те, что касаются получателя.
     *
     * @return list<string>
     */
    private function разбивка(object $notifiable): array
    {
        $id = (int) ($notifiable->id ?? 0);

        if ($id > 0 && $id === (int) $this->deal->seller_id) {
            return $this->продавцу();
        }

        if ($id > 0 && $id === (int) $this->deal->buyer_id) {
            return $this->покупателю();
        }

        return ['Сумма сделки: '.$this->рубли($this->deal->amount_kopecks)];
    }

    /** Комиссию платит покупатель? У сделок до 27.09 — нет. */
    private function комиссияПокупателя(): bool
    {
        return ($this->deal->fee_payer ?? SafeDealFeePayer::Seller) === SafeDealFeePayer::Buyer;
    }

    /**
     * Фактические доли при разделении суммы в споре.
     *
     * `splitPayout` не трогает `seller_payout_kopecks` и `amount_kopecks`
     * — доли пишутся сюда. Значит это и есть единственное место, где
     * записано, сколько кому досталось на самом деле.
     *
     * @return array{buyer: int, seller: int}|null
     */
    private function доли(): ?array
    {
        $split = $this->deal->metadata['split'] ?? null;

        if (! is_array($split) || ! array_key_exists('seller_kopecks', $split)) {
            return null;
        }

        return [
            'buyer' => (int) ($split['buyer_kopecks'] ?? 0),
            'seller' => (int) ($split['seller_kopecks'] ?? 0),
        ];
    }

    /** Деньги вернулись покупателю целиком: отмена или возврат без разделения. */
    private function этоВозврат(): bool
    {
        $status = $this->deal->status instanceof SafeDealStatus
            ? $this->deal->status
            : SafeDealStatus::tryFrom((string) $this->deal->status);

        return $this->доли() === null
            && in_array($status, [SafeDealStatus::Cancelled, SafeDealStatus::Refunded], true);
    }

    private function завершена(): bool
    {
        $status = $this->deal->status instanceof SafeDealStatus
            ? $this->deal->status
            : SafeDealStatus::tryFrom((string) $this->deal->status);

        return $status === SafeDealStatus::Completed;
    }

    /** @return list<string> */
    private function покупателю(): array
    {
        if ($this->этоВозврат()) {
            $строки = ['Возвращено: '.$this->рубли($this->deal->amount_kopecks)];

            if ($this->комиссияПокупателя() && (int) $this->deal->platform_fee_kopecks > 0) {
                $строки[] = 'Комиссия возвращена вместе с суммой.';
            }

            return $строки;
        }

        if ($доли = $this->доли()) {
            /*
             * Ноль — отдельной фразой, как и у продавца. «Возвращено:
             * 0,00 ₽» читается как несуществующий перевод, о котором
             * зачем-то написали, — тот же довод, по которому в этом файле
             * скрывается нулевая доставка. Спор целиком в пользу продавца
             * достижим: админская ручка разрешения спора принимает
             * `buyer_kopecks = 0`.
             */
            if ($доли['buyer'] <= 0) {
                return ['Возврата по этой сделке нет: спор решён в пользу продавца.'];
            }

            $строки = ['Возвращено: '.$this->рубли($доли['buyer'])];

            if ($this->комиссияПокупателя() && (int) $this->deal->platform_fee_kopecks > 0) {
                $строки[] = 'Комиссия возвращена полностью и в делёж не входила.';
            }

            return $строки;
        }

        $строки = ['Товар: '.$this->рубли($this->deal->item_kopecks)];

        /*
         * Комиссия показывается покупателю только когда он её платит. По
         * старым сделкам она вычиталась у продавца, и строка о ней в
         * письме покупателя выглядела бы как ещё одна его трата.
         */
        if ($this->комиссияПокупателя() && (int) $this->deal->platform_fee_kopecks > 0) {
            $строки[] = 'Комиссия безопасной сделки: '.$this->рубли($this->deal->platform_fee_kopecks);
        }

        $строки = [...$строки, ...$this->доставка()];
        // «К оплате» на закрытой сделке звучит как ожидающийся платёж,
        // хотя деньги давно списаны.
        $строки[] = ($this->завершена() ? 'Оплачено: ' : 'К оплате: ').$this->рубли($this->deal->amount_kopecks);

        return $строки;
    }

    /** @return list<string> */
    private function продавцу(): array
    {
        if ($this->этоВозврат()) {
            // Ни суммы, ни обещаний: по отменённой сделке продавец не
            // получает ничего, и называть ему план — обман.
            return ['Выплаты по этой сделке не будет: сумма возвращена покупателю.'];
        }

        if ($доли = $this->доли()) {
            return $доли['seller'] > 0
                ? ['Выплачено: '.$this->рубли($доли['seller']).' — по решению спора сумма разделена.']
                : ['Выплаты по этой сделке нет: спор решён в пользу покупателя.'];
        }

        $строки = ['Товар: '.$this->рубли($this->deal->item_kopecks)];
        $строки = [...$строки, ...$this->доставка()];
        $строки[] = ($this->завершена() ? 'Выплачено: ' : 'К выплате: ')
            .$this->рубли($this->deal->seller_payout_kopecks);

        if ((int) $this->deal->platform_fee_kopecks > 0) {
            $строки[] = $this->комиссияПокупателя()
                ? 'Комиссию оплатил покупатель — вы получаете полную стоимость товара.'
                : 'Комиссия '.$this->рубли($this->deal->platform_fee_kopecks).' удержана из выплаты.';
        }

        return $строки;
    }

    /**
     * Строка доставки — только когда доставка есть.
     *
     * «Доставка: 0,00 ₽» при самовывозе читается не как ноль рублей, а
     * как несуществующая услуга, про которую зачем-то написали.
     *
     * @return list<string>
     */
    private function доставка(): array
    {
        $стоимость = (int) $this->deal->delivery_cost_kopecks;

        return $стоимость > 0 ? ['Доставка: '.$this->рубли($стоимость)] : [];
    }

    private function рубли(mixed $копейки): string
    {
        return number_format(((int) $копейки) / 100, 2, ',', ' ').' ₽';
    }
}
