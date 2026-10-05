<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Modules\Billing\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Срок открытия спора: что происходит ровно в секунду истечения.
 *
 * Playbook держит это отдельным решением (DEC-08), потому что
 * «до истечения `hold_expires_at`» в требовании написано, а что считать
 * самой границей — нет. Разница в одну секунду, но она решает, кто платит
 * за спорный товар, и спорить об этом с человеком post factum нечем.
 *
 * Код отвечает однозначно: `SafeDealService::openDispute` отказывает при
 * `! $deal->hold_expires_at->isFuture()`, то есть в момент истечения спор
 * уже закрыт. Решение на эту ночь — то же самое (NIGHT-RUN, промпт 05).
 * Проверки на это не было: `hold_expires_at` упоминался в тестах один раз,
 * и только чтобы убедиться, что поле отдаётся наружу.
 *
 * Поэтому здесь закрепляются три точки, а не одна: секунда до срока,
 * ровно срок и секунда после. Одной точкой такую границу не закрепить —
 * проверка «за секунду до истечения спор открывается» зеленеет и при
 * нестрогом сравнении, то есть ничего не доказывает.
 *
 * Доказательство откатом (проверено этой ночью): замена `isFuture()` на
 * `isAfter(now()->subSecond())` — то есть смягчение границы на секунду —
 * краснит `test_ровно_в_секунду_истечения_спор_уже_закрыт`.
 */
class DisputeDeadlineIsExactTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.safe_deal.escrow_provider' => 'wallet']);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'escrow.fee.percent'],
            ['value' => ['percent' => 5], 'group' => 'pricing'],
        );
        SystemSetting::query()->updateOrCreate(
            ['key' => 'escrow.fee.min_cents'],
            ['value' => ['min_cents' => 0], 'group' => 'pricing'],
        );
    }

    public function test_за_секунду_до_срока_спор_открывается(): void
    {
        [$buyer, $deal] = $this->оплаченнаяСделка();

        /*
         * Время заморожено, как и в проверке самой границы ниже.
         *
         * Без этого проверка мерила не границу, а скорость машины: между
         * записью `now()->addSecond()` и сравнением в обработчике проходит
         * реальное время, и под полной нагрузкой эта секунда истекала
         * раньше, чем запрос доходил до `isFuture()`. Прогон 05.10 из 1653
         * тестов валил её, а она же отдельным прогоном зеленела — то есть
         * ответ зависел от загрузки машины, а не от кода.
         *
         * Логику границы это не меняет: точка по-прежнему «секунда до
         * срока», просто теперь она именно секунда, а не «секунда минус
         * задержка».
         */
        $this->freezeTime();
        $deal->forceFill(['hold_expires_at' => now()->addSecond()])->save();

        $this->спор($buyer, $deal)->assertCreated();
    }

    public function test_ровно_в_секунду_истечения_спор_уже_закрыт(): void
    {
        [$buyer, $deal] = $this->оплаченнаяСделка();

        /*
         * Ровно `now()`, а не «секунду назад»: именно эта точка и есть
         * предмет решения. Запись и сравнение идут через один и тот же
         * `now()`, замороженный тестом, иначе между ними пройдёт
         * микросекунда и проверка начнёт мерить не границу, а задержку.
         */
        $this->freezeTime();
        $deal->forceFill(['hold_expires_at' => now()])->save();

        $this->спор($buyer, $deal)
            ->assertStatus(422)
            ->assertJsonPath('errors.deal.0', 'Срок для открытия спора истёк.');
    }

    public function test_через_секунду_после_срока_спор_закрыт(): void
    {
        [$buyer, $deal] = $this->оплаченнаяСделка();
        $deal->forceFill(['hold_expires_at' => now()->subSecond()])->save();

        $this->спор($buyer, $deal)
            ->assertStatus(422)
            ->assertJsonPath('errors.deal.0', 'Срок для открытия спора истёк.');
    }

    /**
     * Срок не задан — спор открывается.
     *
     * Так выглядит сделка в одностадийном режиме до того, как срок
     * проставлен. Проверка стоит здесь, чтобы ужесточение границы не
     * закрыло спор тем, у кого срока нет вовсе: `null` — это «окно
     * открыто», а не «срок истёк».
     */
    public function test_без_срока_спор_открывается(): void
    {
        [$buyer, $deal] = $this->оплаченнаяСделка();
        $deal->forceFill(['hold_expires_at' => null])->save();

        $this->спор($buyer, $deal)->assertCreated();
    }

    private function спор(User $buyer, SafeDeal $deal)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($buyer, 'sanctum')->postJson(
            "/api/v1/safe-deals/{$deal->uuid}/dispute",
            ['reason' => 'not_received', 'description' => 'Товар не пришёл'],
        );
    }

    /** @return array{0: User, 1: SafeDeal} */
    private function оплаченнаяСделка(int $цена = 100_000): array
    {
        $seller = $this->человек('Продавец');
        $buyer = $this->человек('Покупатель');
        $listing = $this->объявление($seller, $цена);
        app(WalletService::class)->credit($buyer, (int) round($цена * 1.05), WalletTransactionType::Topup, 'проба');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->json('data.uuid');

        return [$buyer, SafeDeal::query()->where('uuid', $uuid)->firstOrFail()];
    }

    private function человек(string $имя, UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function объявление(User $seller, int $цена): Listing
    {
        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => ListingCategory::query()->create([
                'name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1,
            ])->id,
            'title' => 'Лот',
            'slug' => 'lot-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => $цена,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }
}
