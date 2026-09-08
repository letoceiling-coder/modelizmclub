<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\Payment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * История платежей: что человек покупал и чем это кончилось.
 *
 * Экран нужен ровно для того, чего не видно в кошельке: платежей, которые не
 * дошли. У пользователя 606 таких двенадцать, и по кошельку он никогда бы не
 * узнал, что заплатил 1 097 ₽ и не получил ничего.
 */
class MyPaymentsHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function seedUser(string $suffix = 'a'): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Payer',
            'slug' => "payer-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function payment(User $user, string $status, array $metadata, int $cents = 9900): Payment
    {
        return Payment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'amount_cents' => $cents,
            'currency' => 'RUB',
            'status' => $status,
            'provider' => 'vtb',
            'idempotency_key' => (string) Str::uuid(),
            'metadata' => $metadata,
        ]);
    }

    public function test_guest_is_refused(): void
    {
        $this->getJson('/api/v1/users/me/payments')->assertUnauthorized();
    }

    public function test_history_shows_purpose_amount_status_and_date(): void
    {
        $user = $this->seedUser();
        $plan = SubscriptionPlan::query()->create([
            'slug' => 'half-year',
            'name' => 'Полгода',
            'price_cents' => 49900,
            'period_days' => 182,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $paid = $this->payment($user, 'paid', ['plan_id' => $plan->id], 49900);
        $paid->forceFill(['paid_at' => now()])->save();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/payments')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $paid->uuid)
            ->assertJsonPath('data.0.type', 'subscription')
            ->assertJsonPath('data.0.plan_name', 'Полгода')
            ->assertJsonPath('data.0.amount', 49900)
            ->assertJsonPath('data.0.amount_rub', 499)
            ->assertJsonPath('data.0.status', 'paid')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonStructure(['data' => [['uuid', 'amount', 'status', 'type', 'date', 'paid_at']]]);
    }

    public function test_history_shows_payments_that_never_arrived(): void
    {
        $user = $this->seedUser('b');
        $this->payment($user, 'pending', ['plan_id' => 1]);
        $this->payment($user, 'failed', ['payable_type' => 'wallet_topup'], 30000);

        $body = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/payments')
            ->assertOk()
            ->json('data');

        $statuses = array_column($body, 'status');
        sort($statuses);

        // Именно эти две строки и есть смысл экрана: в кошельке их нет вовсе.
        $this->assertSame(['failed', 'pending'], $statuses);
    }

    public function test_topup_is_not_labelled_other(): void
    {
        $user = $this->seedUser('c');
        $this->payment($user, 'paid', ['payable_type' => 'wallet_topup'], 30000);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/payments')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'topup')
            ->assertJsonPath('data.0.type_label', 'Пополнение кошелька');
    }

    public function test_history_is_private_to_its_owner(): void
    {
        $mine = $this->seedUser('d');
        $theirs = $this->seedUser('e');
        $this->payment($theirs, 'paid', ['plan_id' => 1]);

        $this->actingAs($mine, 'sanctum')
            ->getJson('/api/v1/users/me/payments')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_newest_payment_comes_first(): void
    {
        $user = $this->seedUser('f');
        $old = $this->payment($user, 'paid', ['payable_type' => 'wallet_topup']);
        $old->forceFill(['created_at' => now()->subDays(3)])->save();
        $fresh = $this->payment($user, 'pending', ['plan_id' => 1]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/users/me/payments')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $fresh->uuid)
            ->assertJsonPath('data.1.uuid', $old->uuid);
    }
}
