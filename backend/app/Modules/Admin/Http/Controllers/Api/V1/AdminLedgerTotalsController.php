<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Enums\WalletTransactionType;
use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Итоги по деньгам за период: принято, выплачено, в кошельках, комиссия.
 *
 * Считать их на стороне браузера нельзя: списки кошельков и сделок
 * приходят страницами, и сумма по текущей странице — не итог, а случайное
 * число, похожее на итог. Поэтому отдельная ручка со сложением в базе.
 *
 * Про время. Колонки объявлены `timestamp without time zone`, Laravel
 * пишет в них московское время, а `now()` в Postgres отдаёт UTC. Границы
 * периода приходят из браузера как даты, и сравниваются они с тем, что
 * лежит, — то есть с московским стенным временем. Приводить ничего не
 * нужно ровно до тех пор, пока обе стороны сравнения в одном поясе.
 */
#[Group('Admin — Ledger', weight: 60)]
class AdminLedgerTotalsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : null;
        $to = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : null;

        /*
         * Модуль берётся у каждой строки, а не у суммы.
         *
         * Знак в `amount_kopecks` означает направление, и он разный даже
         * внутри одной корзины: `safe_deal_payout` в базе положительный
         * (зачисление продавцу), `withdrawal` отрицательный (списание).
         * `abs(sum(...))` сложил бы их со взаимным гашением и спрятал это
         * под модулем: 475 000 и −100 000 дали бы 375 000 вместо 575 000.
         * Проверено по боевым данным 25.09.
         */
        $сумма = function (array $types) use ($from, $to): int {
            $q = DB::table('wallet_transactions')->whereIn('type', $types);
            if ($from !== null) {
                $q->where('created_at', '>=', $from);
            }
            if ($to !== null) {
                $q->where('created_at', '<=', $to);
            }

            return (int) $q->sum(DB::raw('abs(amount_kopecks)'));
        };

        $комиссия = static function (?Carbon $from, ?Carbon $to): int {
            $q = DB::table('safe_deals')->where('status', 'completed');
            if ($from !== null) {
                $q->where('created_at', '>=', $from);
            }
            if ($to !== null) {
                $q->where('created_at', '<=', $to);
            }

            return (int) $q->sum('platform_fee_kopecks');
        };

        return response()->json(['data' => [
            // Принято — пополнения кошельков. Деньги, пришедшие на площадку.
            'received_kopecks' => $сумма([WalletTransactionType::Topup->value]),
            /*
             * Выплачено — то, что ушло с площадки наружу, то есть выводы.
             *
             * `safe_deal_payout` сюда не входит намеренно: это зачисление
             * продавцу внутри площадки, деньги остаются в кошельке и
             * попадают в «В кошельках» ниже. Сложить их с выводами значило
             * бы посчитать одни и те же деньги дважды.
             */
            'paid_out_kopecks' => $сумма([WalletTransactionType::Withdrawal->value]),
            /* Отдельно — сколько зачислено продавцам по завершённым сделкам. */
            'payouts_to_sellers_kopecks' => $сумма([WalletTransactionType::SafeDealPayout->value]),
            /*
             * Комиссия берётся из сделок, а не из проводок.
             *
             * Тип `safe_deal_commission` в перечне есть, но его не пишет
             * никто: в боевой базе на 25.09 ноль таких строк, а удержание
             * записывается в журнал сделки (`SafeDealService::log`) и живёт
             * в колонке `platform_fee_kopecks`. Считать по проводкам значило
             * бы всегда показывать ноль — и это выглядело бы как «комиссии
             * нет», а не как «считаем не оттуда».
             *
             * Только завершённые: у отменённой комиссия посчитана, но не
             * удержана — на 25.09 это 4 166 ₽ по 31 отменённой сделке,
             * которых площадка не получала.
             */
            'commission_kopecks' => $комиссия($from, $to),
            /*
             * В кошельках — остаток на сейчас, а не за период: это снимок,
             * и границы дат к нему неприменимы. Залог показываем отдельно:
             * он принадлежит незакрытым сделкам, а не людям.
             */
            'wallets_balance_kopecks' => (int) DB::table('wallets')->sum('balance_kopecks'),
            'wallets_held_kopecks' => (int) DB::table('wallets')->sum('held_kopecks'),
            'period' => [
                'from' => $from?->toDateString(),
                'to' => $to?->toDateString(),
            ],
        ]]);
    }
}
