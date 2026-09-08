<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\SafeDealService;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * Гонка подтверждения и спора по одной сделке.
 *
 * Найдено проверками 08.09 на тестовых ключах ВТБ (deploy/docs/vtb-go-live.md,
 * §7). Одновременные «Подтвердить получение» и «Открыть спор» проходили оба:
 * сделка становилась `completed`, спор оставался `open`, деньги уже у
 * продавца. Модератор, решивший такой спор в пользу покупателя, выплачивал
 * полную сумму сверх выплаченной продавцу — по сделке в 1 000 ₽ уходило
 * 1 950 ₽. Ключ идемпотентности `safe-deal-payout:{id}` защищает только от
 * второй выплаты продавцу и к возврату покупателю отношения не имеет.
 *
 * Здесь гонка воспроизводится тем же, чем она является в бою: двумя копиями
 * одной строки, прочитанными до того, как любая из них изменилась. Каждый
 * HTTP-запрос читает сделку сам, поэтому вторая копия ничего не знает о
 * решении первой — ровно как два обработчика в разных процессах.
 */
class SafeDealRaceTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedListing(User $seller, int $priceCents = 100000): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Test listing',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    /** @return array{0: User, 1: User, 2: SafeDeal} */
    private function shippedDeal(): array
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 100000, WalletTransactionType::Topup, 'test top-up');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->json('data.uuid');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$uuid}/ship", ['tracking_number' => 'TRK'])
            ->assertOk();

        return [$seller, $buyer, SafeDeal::query()->where('uuid', $uuid)->firstOrFail()];
    }

    public function test_confirm_started_before_dispute_does_not_pay_seller(): void
    {
        [$seller, $buyer, $deal] = $this->shippedDeal();
        $deals = app(SafeDealService::class);

        // Две копии одной сделки: их прочитали два запроса до того, как хоть
        // один что-то изменил. Обе видят статус shipped.
        $seenByConfirm = SafeDeal::query()->whereKey($deal->id)->firstOrFail();
        $seenByDispute = SafeDeal::query()->whereKey($deal->id)->firstOrFail();

        $deals->openDispute($buyer, $seenByDispute, 'not_delivered', null);

        // Подтверждение опоздало: спор уже открыт. Проверка статуса в самом
        // начале смотрит в устаревшую копию и пропускает — значение имеет
        // только повторная проверка под блокировкой строки.
        try {
            $deals->confirm($buyer, $seenByConfirm);
            $this->fail('Подтверждение прошло после открытия спора — деньги ушли продавцу.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('deal', $e->errors());
        }

        $deal->refresh();
        $this->assertSame(SafeDealStatus::Disputed, $deal->status);
        $this->assertNull($deal->payout_transaction_id);
        $this->assertSame(0, app(WalletService::class)->balanceKopecks($seller->fresh()));
        $this->assertSame(100000, (int) app(WalletService::class)->wallet($buyer->fresh())->held_kopecks);
    }

    public function test_dispute_started_before_confirm_does_not_open(): void
    {
        [$seller, $buyer, $deal] = $this->shippedDeal();
        $deals = app(SafeDealService::class);

        $seenByConfirm = SafeDeal::query()->whereKey($deal->id)->firstOrFail();
        $seenByDispute = SafeDeal::query()->whereKey($deal->id)->firstOrFail();

        $deals->confirm($buyer, $seenByConfirm);

        try {
            $deals->openDispute($buyer, $seenByDispute, 'not_delivered', null);
            $this->fail('Спор открылся по уже завершённой сделке.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('deal', $e->errors());
        }

        $deal->refresh();
        $this->assertSame(SafeDealStatus::Completed, $deal->status);
        $this->assertDatabaseMissing('disputes', ['safe_deal_id' => $deal->id]);
        // Ровно одна выплата продавцу — сумма сделки за вычетом комиссии.
        $this->assertSame(
            (int) $deal->seller_payout_kopecks,
            app(WalletService::class)->balanceKopecks($seller->fresh()),
        );
    }

    public function test_cancel_started_before_confirm_does_not_refund_twice(): void
    {
        [$seller, $buyer, $deal] = $this->shippedDeal();
        $deals = app(SafeDealService::class);

        $seenByConfirm = SafeDeal::query()->whereKey($deal->id)->firstOrFail();
        $seenByCancel = SafeDeal::query()->whereKey($deal->id)->firstOrFail();

        $deals->confirm($buyer, $seenByConfirm);

        try {
            $deals->cancel($buyer, $seenByCancel);
            $this->fail('Отмена прошла по уже завершённой сделке — покупателю вернули оплаченное.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('deal', $e->errors());
        }

        $deal->refresh();
        $this->assertSame(SafeDealStatus::Completed, $deal->status);
        $this->assertNull($deal->refund_transaction_id);
        // Продавцу выплачено ровно один раз, покупателю ничего не вернулось.
        $this->assertSame(
            (int) $deal->seller_payout_kopecks,
            app(WalletService::class)->balanceKopecks($seller->fresh()),
        );
        $this->assertSame(0, app(WalletService::class)->balanceKopecks($buyer->fresh()));
    }
}
