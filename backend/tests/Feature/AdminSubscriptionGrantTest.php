<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\UserSubscription;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ручная выдача подписки из админки.
 *
 * Прежние тесты проверяли ответ эндпоинта и строку в таблице — и то и другое
 * было в порядке, пока на проде 06.09 не выяснилось, что доступа у человека
 * всё равно нет: `hasActiveSubscription()` требует сверх живой строки либо
 * оплаченный платёж, либо промо-признак, а выдача не делала ни того, ни
 * другого. Поэтому здесь проверяется не ответ, а последствие — то, что
 * решает доступ на самом деле.
 */
class AdminSubscriptionGrantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        SubscriptionPlan::query()->updateOrCreate(
            ['slug' => 'year'],
            ['name' => 'Год', 'price_cents' => 99000, 'currency' => 'RUB', 'duration_days' => 365, 'sort_order' => 1],
        );
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
    }

    private function member(): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => 'Подопытный',
            'slug' => 'granted-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    public function test_activation_actually_grants_access(): void
    {
        $user = $this->member();

        $this->assertFalse($user->hasActiveSubscription(), 'подписки быть не должно до выдачи');

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'activate', 'days' => 365])
            ->assertOk()
            ->assertJsonPath('data.is_active', true);

        // Суть дефекта: строка появлялась, а доступ — нет.
        $this->assertTrue($user->fresh()->hasActiveSubscription());
    }

    public function test_activated_subscription_is_visible_to_the_user(): void
    {
        $user = $this->member();

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'activate', 'days' => 30])
            ->assertOk();

        // До правки этот маршрут отдавал data: null, и фронт показывал
        // «Нужна подписка» человеку, которому её только что выдали.
        $this->actingAs($user->fresh(), 'sanctum')
            ->getJson('/api/v1/users/me/subscription')
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_grant_records_which_admin_issued_it(): void
    {
        $admin = $this->admin();
        $user = $this->member();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'activate'])
            ->assertOk();

        $this->assertSame(
            $admin->id,
            UserSubscription::query()->where('user_id', $user->id)->value('granted_by_admin_id'),
        );
    }

    public function test_deactivation_takes_access_away(): void
    {
        $user = $this->member();
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'activate'])
            ->assertOk();
        $this->assertTrue($user->fresh()->hasActiveSubscription());

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/users/{$user->uuid}/subscription", ['action' => 'deactivate'])
            ->assertOk();

        // Отметка о выдаче остаётся в строке как история, но статус уже
        // cancelled — доступ она открывать не должна.
        $this->assertFalse($user->fresh()->hasActiveSubscription());
    }

    public function test_expired_grant_does_not_open_access(): void
    {
        $user = $this->member();

        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => SubscriptionPlan::query()->value('id'),
            'granted_by_admin_id' => $this->admin()->id,
            'status' => 'active',
            'starts_at' => now()->subYear(),
            'ends_at' => now()->subDay(),
            'auto_renew' => false,
        ]);

        $this->assertFalse($user->fresh()->hasActiveSubscription());
    }

    public function test_row_without_grant_or_payment_still_gives_nothing(): void
    {
        $user = $this->member();

        // Ровно то, что оставляла старая выдача: живая строка и ничего больше.
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => SubscriptionPlan::query()->value('id'),
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
            'auto_renew' => false,
        ]);

        $this->assertTrue($user->fresh()->hasUnexpiredSubscriptionRow());
        $this->assertFalse($user->fresh()->hasActiveSubscription());
    }
}
