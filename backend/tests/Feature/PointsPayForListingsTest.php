<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ListingPricingRule;
use App\Models\Payment;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\BonusPointsPrices;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Services\BonusPointsService;
use Tests\TestCase;

/**
 * Баллы тратятся на размещение и продвижение — и не превращаются в деньги.
 *
 * До этой правки баллы можно было только заработать: `debit` не вызывался
 * ниоткуда, тип `admin_points` не использовался. То есть площадка обещала
 * награду, которую некуда деть.
 *
 * Здесь проверяется весь путь: начислить, списать, посмотреть остаток и
 * проводку. И отдельно — три границы, каждая из которых стоила бы дорого:
 *
 *   не хватает — отказ целиком, без частичной оплаты;
 *   кошелёк не трогается ни на копейку;
 *   в выручку оплата баллами не попадает.
 */
class PointsPayForListingsTest extends TestCase
{
    use RefreshDatabase;

    /** @param array<string, mixed> $значения */
    private function цены(array $значения = []): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => BonusPointsPrices::SETTING_KEY],
            [
                'value' => BonusPointsPrices::normalize(array_merge([
                    'enabled' => true,
                    'listing_placement' => 100,
                ], $значения)),
                'group' => BonusPointsPrices::GROUP,
            ],
        );
    }

    private function человек(int $баллов = 0): User
    {
        $user = User::factory()->create([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        if ($баллов > 0) {
            app(BonusPointsService::class)->credit(
                $user,
                $баллов,
                BonusPointsService::TYPE_REFERRAL,
                'Баллы за приглашённого друга',
            );
        }

        return $user->fresh();
    }

    private function баллы(User $user): int
    {
        return app(BonusPointsService::class)->balance($user->fresh());
    }

    private function оплатитьРазмещение(User $user): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/v1/payments', [
            'payable_type' => 'listing_placement',
            'pay_with' => 'points',
        ]);
    }

    public function test_размещение_оплачивается_баллами(): void
    {
        $this->цены();
        $user = $this->человек(250);

        $ответ = $this->оплатитьРазмещение($user)->assertCreated();

        $this->assertSame('points', $ответ->json('data.provider'));
        $this->assertSame(100, $ответ->json('data.points_spent'));
        $this->assertSame(150, $this->баллы($user), 'остаток не уменьшился на цену');
    }

    public function test_списание_видно_проводкой(): void
    {
        $this->цены();
        $user = $this->человек(250);
        $this->оплатитьРазмещение($user)->assertCreated();

        $проводка = DB::table('bonus_transactions')
            ->where('account_user_id', $user->id)
            ->where('amount', '<', 0)
            ->first();

        $this->assertNotNull($проводка, 'списание не записано в журнал');
        $this->assertSame(-100, (int) $проводка->amount);
        $this->assertSame('listing_placement_points', $проводка->type);
        $this->assertStringContainsString(
            'Размещение объявления',
            (string) $проводка->description,
            'из проводки не видно, за что списали',
        );
    }

    public function test_не_хватает_баллов_частичной_оплаты_нет(): void
    {
        $this->цены();
        $user = $this->человек(40);

        $ответ = $this->оплатитьРазмещение($user)->assertStatus(422);

        $this->assertSame('insufficient_points', $ответ->json('code'));
        $this->assertSame(60, $ответ->json('points_short_by'), 'не названо, сколько не хватает');
        $this->assertStringContainsString('60', (string) $ответ->json('message'));

        // Главное: ничего не списалось и ничего не выдалось.
        $this->assertSame(40, $this->баллы($user), 'баллы ушли при отказе');
        $this->assertSame(0, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_кошелёк_не_трогается(): void
    {
        $this->цены();
        $user = $this->человек(250);
        $было = (int) (DB::table('wallets')->where('user_id', $user->id)->value('balance_kopecks') ?? 0);

        $this->оплатитьРазмещение($user)->assertCreated();

        $стало = (int) (DB::table('wallets')->where('user_id', $user->id)->value('balance_kopecks') ?? 0);
        $this->assertSame($было, $стало, 'оплата баллами тронула рублёвый баланс');
        $this->assertSame(
            0,
            DB::table('wallet_transactions')->where('user_id', $user->id)->count(),
            'оплата баллами завела проводку в кошельке',
        );
    }

    public function test_оплата_баллами_не_попадает_в_выручку(): void
    {
        /*
         * Записать в `payments.amount_cents` рублёвую цену было бы удобно
         * для истории и разрушительно для бухгалтерии: выручка выросла бы
         * на деньги, которых никто не платил. Сегодня это уже чинили
         * дважды — на комиссии по разделённым сделкам и в письме.
         */
        $this->цены();
        $user = $this->человек(250);
        $this->оплатитьРазмещение($user)->assertCreated();

        $payment = Payment::query()->where('user_id', $user->id)->firstOrFail();

        $this->assertSame(0, (int) $payment->amount_cents);
        $this->assertSame('points', $payment->provider);
        $this->assertSame(100, (int) ($payment->metadata['points_spent'] ?? 0));
    }

    public function test_подписка_баллами_не_оплачивается(): void
    {
        // Решение, а не недоделка: подписка месячная, её продают за деньги.
        $this->цены();
        $user = $this->человек(100000);
        $plan = \App\Models\SubscriptionPlan::query()->create([
            'slug' => 'month-'.uniqid(),
            'name' => 'Месяц',
            'price_cents' => 9900,
            'period_days' => 30,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => $plan->slug, 'pay_with' => 'points'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('pay_with')
            /*
             * Причина, а не только отказ. Без этой строки проверка
             * проходила и на коде, где `points` вовсе не значился среди
             * допустимых значений: отказ был, но совсем про другое.
             */
            ->assertJsonFragment(['pay_with' => ['Подписка баллами не оплачивается.']]);

        $this->assertSame(100000, $this->баллы($user));
    }

    public function test_выключенные_цены_закрывают_оплату_баллами(): void
    {
        $this->цены(['enabled' => false]);
        $user = $this->человек(250);

        // И снова причина: «недоступна», а не «такого способа нет».
        $this->оплатитьРазмещение($user)
            ->assertStatus(422)
            ->assertJsonFragment(['pay_with' => ['Оплата баллами сейчас недоступна.']]);

        $this->assertSame(250, $this->баллы($user));
    }

    public function test_ручка_баллов_показывает_остаток_и_историю(): void
    {
        $this->цены();
        $user = $this->человек(250);
        $this->оплатитьРазмещение($user)->assertCreated();

        $data = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/bonus-points')
            ->assertOk()
            ->json('data');

        $this->assertSame(150, $data['balance']);
        $this->assertSame(100, $data['listing_placement_points']);
        $this->assertSame(250, $data['earned_by_referrals'], 'заработанное считается по начислениям');

        $суммы = array_column($data['history'], 'amount');
        $this->assertContains(250, $суммы, 'в истории нет начисления');
        $this->assertContains(-100, $суммы, 'в истории нет списания');
    }

    public function test_продвижение_оплачивается_баллами(): void
    {
        $правило = ListingPricingRule::query()->create([
            'category_id' => null,
            'duration_days' => 7,
            'base_price_cents' => 30000,
            'settings' => ['type' => 'boost', 'package_id' => 'boost-7', 'label' => 'Неделя'],
        ]);

        $this->цены(['boosts' => ['boost-7' => 300]]);
        $user = $this->человек(500);
        $listing = $this->объявление($user);

        $ответ = $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/promote", [
                'package' => 'boost-7',
                'pay_with' => 'points',
            ])
            ->assertCreated();

        $this->assertSame('points', $ответ->json('data.provider'));
        $this->assertSame(200, $this->баллы($user), 'списалась не цена пакета');
        $this->assertNotNull($правило->fresh());
    }

    public function test_пакет_без_цены_в_баллах_не_оплачивается_баллами(): void
    {
        ListingPricingRule::query()->create([
            'category_id' => null,
            'duration_days' => 7,
            'base_price_cents' => 30000,
            'settings' => ['type' => 'boost', 'package_id' => 'boost-7', 'label' => 'Неделя'],
        ]);

        // Цена не назначена — значит вариант только за деньги.
        $this->цены(['boosts' => []]);
        $user = $this->человек(500);
        $listing = $this->объявление($user);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/promote", [
                'package' => 'boost-7',
                'pay_with' => 'points',
            ])
            ->assertStatus(422);

        $this->assertSame(500, $this->баллы($user));
    }

    public function test_повторный_запрос_с_тем_же_ключом_списывает_один_раз(): void
    {
        /*
         * Два нажатия «Оплатить» — это два запроса. Или одно нажатие и
         * ретрай после таймаута: ответ потерялся, а покупка прошла. Без
         * ключа попытки баллы ушли бы дважды, а продвижение выдалось бы на
         * двойной срок.
         */
        $this->цены();
        $user = $this->человек(250);

        $запрос = [
            'payable_type' => 'listing_placement',
            'pay_with' => 'points',
            'idempotency_key' => 'попытка-один',
        ];

        $первый = $this->actingAs($user, 'sanctum')->postJson('/api/v1/payments', $запрос)->assertCreated();
        $второй = $this->actingAs($user, 'sanctum')->postJson('/api/v1/payments', $запрос)->assertCreated();

        $this->assertSame(
            $первый->json('data.payment_uuid'),
            $второй->json('data.payment_uuid'),
            'повтор завёл вторую покупку',
        );
        $this->assertSame(150, $this->баллы($user), 'списано дважды');
        $this->assertSame(1, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_разные_ключи_это_разные_покупки(): void
    {
        // Контроль: иначе «один раз» означало бы, что вторая покупка
        // не проходит вовсе.
        $this->цены();
        $user = $this->человек(250);

        foreach (['первая', 'вторая'] as $ключ) {
            $this->actingAs($user, 'sanctum')->postJson('/api/v1/payments', [
                'payable_type' => 'listing_placement',
                'pay_with' => 'points',
                'idempotency_key' => $ключ,
            ])->assertCreated();
        }

        $this->assertSame(50, $this->баллы($user));
        $this->assertSame(2, Payment::query()->where('user_id', $user->id)->count());
    }

    public function test_промокод_при_оплате_баллами_не_сгорает(): void
    {
        /*
         * Цена в баллах фиксированная и от скидки не зависит. Если бы код
         * уехал в выдачу, он списался бы как использованный — человек
         * потерял бы одноразовый промокод, не получив от него ничего.
         */
        $this->цены();
        $user = $this->человек(250);

        $promo = \App\Models\Promocode::query()->create([
            'code' => 'SKIDKA',
            'type' => 'percent',
            'value' => 50,
            'is_active' => true,
            'applies_to' => 'listing_placement',
        ]);

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/payments', [
            'payable_type' => 'listing_placement',
            'pay_with' => 'points',
            'promocode' => 'SKIDKA',
        ])->assertCreated();

        $payment = Payment::query()->where('user_id', $user->id)->firstOrFail();
        $this->assertNull(
            $payment->metadata['promocode_id'] ?? null,
            'промокод уехал в оплату баллами и сгорел бы при выдаче',
        );
        $this->assertSame(
            0,
            DB::table('promocode_usages')->where('promocode_id', $promo->id)->count(),
            'промокод списан, хотя скидки не дал',
        );
    }

    private function объявление(User $user): \App\Models\Listing
    {
        return \App\Models\Listing::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => $user->id,
            'category_id' => \App\Models\ListingCategory::query()->create([
                'name' => 'Авиация',
                'slug' => 'aviatsiya-'.\Illuminate\Support\Str::random(6),
            ])->id,
            'title' => 'Лот',
            'slug' => 'lot-'.\Illuminate\Support\Str::random(8),
            'description' => 'Описание',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => \App\Enums\ListingStatus::Published,
        ]);
    }
}
