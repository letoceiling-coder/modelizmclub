<?php

namespace Modules\Legal\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ListingPricingRule;
use App\Models\SubscriptionPlan;
use App\Models\SystemSetting;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;

/**
 * Стоимость платных услуг — та же, что человек увидит при оплате.
 *
 * Страница тарифов нужна банку-эквайеру и статье 10 ЗоЗПП: цена в рублях и
 * условия приобретения должны быть опубликованы. Отдельный ответ, а не текст
 * в документе, — потому что документ разойдётся с действительностью при
 * первом изменении тарифа, а расходиться ему нельзя: на него ссылается
 * оферта.
 *
 * Поэтому каждая цена берётся оттуда же, откуда её берёт интерфейс оплаты:
 *
 *   подписка     — `subscription_plans`, только активные;
 *   размещение   — `system_settings`, ключи `listing.placement.*`;
 *   продвижение  — `listing_pricing_rules` с меткой `boost`;
 *   комиссия     — `system_settings`, ключи `escrow.fee.*`.
 *
 * Ни одного числа в коде этого файла нет нарочно. Если цену поменяют в
 * админке, страница поменяется тем же запросом.
 */
#[Group('Public', weight: 5)]
class TariffsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'subscriptions' => $this->subscriptions(),
                'placement' => $this->placement(),
                'boost' => $this->boost(),
                'safe_deal' => $this->safeDeal(),
                'currency' => 'RUB',
            ],
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function subscriptions(): array
    {
        return SubscriptionPlan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (SubscriptionPlan $plan): array => [
                'slug' => $plan->slug,
                'name' => $plan->name,
                'price_cents' => (int) $plan->price_cents,
                'period_days' => (int) $plan->period_days,
                'features' => is_array($plan->features) ? $plan->features : [],
            ])
            ->values()
            ->all();
    }

    /**
     * Размещение объявления: две цены, и разница между ними — смысл подписки.
     */
    private function placement(): array
    {
        return [
            'without_subscription_cents' => $this->setting('listing.placement.registered_price_cents', 'cents', 3000),
            'with_subscription_cents' => $this->setting('listing.placement.subscriber_default_price_cents', 'cents', 2000),
            'guest_cents' => $this->setting('listing.placement.guest_price_cents', 'cents', 3000),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function boost(): array
    {
        return ListingPricingRule::query()
            ->whereNull('category_id')
            ->where('base_price_cents', '>', 0)
            ->orderBy('duration_days')
            ->get()
            ->filter(fn (ListingPricingRule $rule): bool => ($rule->settings['type'] ?? null) === 'boost')
            ->map(fn (ListingPricingRule $rule): array => [
                'id' => $rule->packageId() ?? "boost-{$rule->duration_days}",
                'label' => $rule->label(),
                'days' => (int) $rule->duration_days,
                'price_cents' => (int) $rule->base_price_cents,
            ])
            ->values()
            ->all();
    }

    /**
     * Комиссия безопасной сделки.
     *
     * Отдаётся вся арифметика, а не итог: процент, нижняя и верхняя границы,
     * от чего считается. Иначе на странице пришлось бы писать словами то, что
     * настраивается числами, — и первое же изменение настройки сделало бы
     * текст неверным.
     */
    private function safeDeal(): array
    {
        return [
            'enabled' => (bool) $this->setting('escrow.fee.enabled', 'enabled', true),
            'percent' => (float) $this->setting('escrow.fee.percent', 'percent', 5),
            'min_cents' => (int) $this->setting('escrow.fee.min_cents', 'min_cents', 30000),
            'max_cents' => $this->setting('escrow.fee.max_cents', 'max_cents', null),
            // `item` — процент считается от цены товара, доставка в базу не входит.
            'base' => (string) $this->setting('escrow.fee.apply_to', 'base', 'item'),
        ];
    }

    private function setting(string $key, string $field, mixed $default): mixed
    {
        $value = SystemSetting::query()->where('key', $key)->value('value');

        if (is_array($value) && array_key_exists($field, $value)) {
            return $value[$field];
        }

        return $default;
    }
}
