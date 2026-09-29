<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BonusTransaction;
use App\Support\BonusPointsPrices;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\BonusPointsService;
use Modules\Listing\Services\ListingBoostService;

/**
 * Счёт баллов: остаток, история и во что их можно обратить.
 *
 * ОТДЕЛЬНО ОТ КОШЕЛЬКА. Баллы не рубли и не выводятся; складывать их в
 * ручку кошелька значило бы однажды сложить и числа. Здесь свой остаток,
 * своя история и свои цены.
 *
 * ЦЕНЫ ОТДАЮТСЯ ВМЕСТЕ С ОСТАТКОМ. Иначе странице пришлось бы спрашивать
 * дважды и самой решать, хватает ли, — то есть держать у себя второе
 * представление о правиле, которое живёт в настройках.
 */
#[Group('Billing', weight: 72)]
class BonusPointsController extends Controller
{
    public function __invoke(Request $request, BonusPointsService $points, ListingBoostService $boost): JsonResponse
    {
        $user = $request->user();
        $prices = BonusPointsPrices::get();

        $пакеты = collect($boost->packages())
            ->map(fn (array $p) => [
                'id' => $p['id'],
                'label' => $p['label'],
                'days' => $p['days'],
                'price_cents' => $p['price_cents'],
                // Ноль — этот пакет баллами не оплачивается. Не прячем:
                // человек должен видеть, что вариант существует, но
                // доступен только за деньги.
                'points' => (int) ($prices['boosts'][$p['id']] ?? 0),
            ])
            ->all();

        return response()->json([
            'data' => [
                'balance' => $points->balance($user),
                'earned_by_referrals' => $points->earned($user, BonusPointsService::TYPE_REFERRAL),
                'enabled' => $prices['enabled'],
                'listing_placement_points' => $prices['enabled'] ? $prices['listing_placement'] : 0,
                'boosts' => $пакеты,
                'history' => collect($points->history($user, 50))
                    ->map(fn (BonusTransaction $t) => [
                        'id' => $t->id,
                        'amount' => (int) $t->amount,
                        'type' => (string) $t->type,
                        'description' => (string) $t->description,
                        'created_at' => $t->created_at?->toIso8601String(),
                    ])
                    ->all(),
            ],
        ]);
    }
}
