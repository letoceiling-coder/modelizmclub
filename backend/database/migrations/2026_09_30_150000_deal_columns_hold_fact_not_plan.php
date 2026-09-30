<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Колонки сделки держат факт, а не план.
 *
 * ЧТО БЫЛО. `seller_payout_kopecks` и `platform_fee_kopecks` заполнялись
 * при создании сделки и больше не менялись. При разрешении спора
 * делением фактические доли уходили в `metadata.split`, а колонки
 * оставались прежними; при полном возврате — тоже.
 *
 * Каждый читатель узнавал факт сам, и каждый — отдельной правкой:
 * письмо о шаге сделки, сводка бухгалтерии, выгрузка реестра. Четвёртым
 * оказалась страница сделки: продавцу показывали «Выплата продавцу
 * 950 ₽» там, где он получил 400. И пятым — служба выплат: она берёт
 * сумму перевода из этой самой колонки, то есть по разделённой сделке
 * перевела бы план.
 *
 * ЧТО ДЕЛАЕТ МИГРАЦИЯ. Приводит прошлые строки к тому же правилу, по
 * которому теперь пишет код:
 *
 *   разделённые в споре — выплата равна доле продавца из `metadata.split`,
 *       комиссия ноль (удержание раздано целиком);
 *   отменённые и возвращённые — выплата ноль, комиссия ноль.
 *
 * ПЛАН НЕ ТЕРЯЕТСЯ. Стоимость товара (`item_kopecks`) и сумма удержания
 * (`amount_kopecks`) не меняются — по ним договор восстанавливается
 * целиком. У разделённых сохраняется и разбивка в `metadata.split`,
 * включая возвращённую комиссию.
 *
 * ОТКАТ невозможен и это сказано вслух: прежние значения колонок были
 * планом, а плана мы нигде не сохраняли — он вычислялся из цены и
 * правила комиссии на момент создания. Восстановить его задним числом
 * значило бы пересчитать по нынешнему правилу и назвать это прошлым.
 */
return new class extends Migration
{
    public function up(): void
    {
        $разделённых = 0;
        $строки = DB::table('safe_deals')
            ->whereRaw("coalesce(jsonb_exists(metadata::jsonb, 'split'), false)")
            ->get(['id', 'metadata', 'seller_payout_kopecks', 'platform_fee_kopecks']);

        foreach ($строки as $строка) {
            $meta = json_decode((string) $строка->metadata, true);
            $доля = $meta['split']['seller_kopecks'] ?? null;

            // Без доли продавца строку не трогаем: выдумывать факт нельзя.
            if (! is_numeric($доля)) {
                continue;
            }

            DB::table('safe_deals')->where('id', $строка->id)->update([
                'seller_payout_kopecks' => (int) $доля,
                'platform_fee_kopecks' => 0,
            ]);
            $разделённых++;
        }

        $возвращённых = DB::table('safe_deals')
            ->whereIn('status', ['cancelled', 'refunded'])
            ->whereRaw("not coalesce(jsonb_exists(metadata::jsonb, 'split'), false)")
            ->where(function ($q): void {
                $q->where('seller_payout_kopecks', '>', 0)->orWhere('platform_fee_kopecks', '>', 0);
            })
            ->update(['seller_payout_kopecks' => 0, 'platform_fee_kopecks' => 0]);

        echo "  сделки: приведено к факту — разделённых {$разделённых}, возвращённых {$возвращённых}\n";
    }

    public function down(): void
    {
        echo "  сделки: откат невозможен — прежние значения были планом, а план нигде не сохранялся\n";
    }
};
