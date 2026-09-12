<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Account\Services\PayoutRequisitesService;
use Modules\Billing\Services\WalletService;
use App\Enums\WalletTransactionType;
use Tests\TestCase;

/**
 * Вывод на сохранённую карту.
 *
 * Полный номер лежит на сервере, наружу уходят только последние четыре, — до
 * 12.09 подставить его в заявку было нечем, и номер набирали заново в окне
 * вывода (аудит 12.09). Теперь клиент шлёт флаг, а номер подставляет сервер.
 */
class WithdrawSavedCardTest extends TestCase
{
    use RefreshDatabase;

    private function fund(User $user, int $kopecks): void
    {
        app(WalletService::class)->credit(
            $user,
            $kopecks,
            WalletTransactionType::Topup,
            'Тестовое пополнение',
            'topup',
            null,
        );
    }

    public function test_saved_card_fills_the_destination(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100_000);
        app(PayoutRequisitesService::class)->update($user, '4111111111111111');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
            'method' => 'card',
            'use_saved_card' => true,
        ])->assertStatus(201);

        $this->assertSame(
            '4111111111111111',
            WithdrawalRequest::query()->where('user_id', $user->id)->value('destination'),
        );
    }

    public function test_saved_card_without_saved_requisites_is_refused(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100_000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
            'method' => 'card',
            'use_saved_card' => true,
        ])->assertStatus(422)->assertJsonPath('code', 'saved_card_missing');

        $this->assertSame(0, WithdrawalRequest::query()->where('user_id', $user->id)->count());
    }

    public function test_saved_card_is_refused_for_other_methods(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100_000);
        app(PayoutRequisitesService::class)->update($user, '4111111111111111');
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
            'method' => 'sbp',
            'use_saved_card' => true,
        ])->assertStatus(422)->assertJsonPath('code', 'saved_card_wrong_method');
    }

    public function test_destination_is_still_required_without_the_flag(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100_000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/withdraw', ['amount' => 500, 'method' => 'card'])
            ->assertStatus(422);
    }

    public function test_explicit_destination_still_works(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100_000);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 500,
            'method' => 'card',
            'destination' => '5555444433332222',
        ])->assertStatus(201);

        $this->assertSame(
            '5555444433332222',
            WithdrawalRequest::query()->where('user_id', $user->id)->value('destination'),
        );
    }
}
