<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Channel;
use App\Models\Payment;
use App\Models\User;
use App\Support\RolePrivileges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Льготы на человека, независимо от роли (решение 19.09): «подписка не
 * требуется» и персональная квота размещений. Умолчания выставляет
 * назначение роли, дальше Владелец правит любое значение.
 */
class UserPrivilegesTest extends TestCase
{
    use RefreshDatabase;

    private function person(UserRole $role = UserRole::User, array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $attrs));
    }

    public function test_role_defaults_follow_the_decision(): void
    {
        $this->assertSame(
            ['subscription_exempt' => true, 'free_listings_quota' => 0, 'free_listings_unlimited' => true],
            RolePrivileges::defaultsFor(UserRole::Owner),
        );
        $this->assertSame(RolePrivileges::defaultsFor(UserRole::Owner), RolePrivileges::defaultsFor(UserRole::Moderator));
        $this->assertSame(
            ['subscription_exempt' => true, 'free_listings_quota' => 10, 'free_listings_unlimited' => false],
            RolePrivileges::defaultsFor(UserRole::CategoryAdmin),
        );
        $this->assertSame(
            ['subscription_exempt' => false, 'free_listings_quota' => 0, 'free_listings_unlimited' => false],
            RolePrivileges::defaultsFor(UserRole::User),
        );
    }

    public function test_assigning_a_role_applies_defaults_and_owner_can_override_in_the_same_request(): void
    {
        $owner = $this->person(UserRole::Owner);
        $target = $this->person();

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$target->uuid}", ['role' => 'category_admin'])
            ->assertOk()
            ->assertJsonPath('data.subscription_exempt', true)
            ->assertJsonPath('data.free_listings_quota', 10)
            ->assertJsonPath('data.free_listings_unlimited', false);

        // Отец: администратор направления с квотой без ограничения.
        $father = $this->person();
        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$father->uuid}", ['role' => 'category_admin', 'free_listings_unlimited' => true])
            ->assertOk()
            ->assertJsonPath('data.free_listings_unlimited', true)
            ->assertJsonPath('data.subscription_exempt', true);

        // Правка льготы без смены роли умолчаний не возвращает.
        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$target->uuid}", ['subscription_exempt' => false])
            ->assertOk();
        $this->assertFalse($target->fresh()->subscription_exempt);
        $this->assertSame(10, $target->fresh()->free_listings_quota);

        // Возврат в обычные — обе льготы сняты, израсходованное сохраняется.
        $target->forceFill(['free_listings_used' => 4])->save();
        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$target->uuid}", ['role' => 'user'])
            ->assertOk();
        $fresh = $target->fresh();
        $this->assertFalse($fresh->subscription_exempt);
        $this->assertSame(0, $fresh->free_listings_quota);
        $this->assertSame(4, $fresh->free_listings_used);
    }

    /**
     * Явное значение, совпавшее с прежним, — тоже решение Владельца: смена
     * роли в том же запросе не заменяет его умолчанием.
     */
    public function test_explicit_value_equal_to_the_current_one_survives_a_role_change(): void
    {
        $owner = $this->person(UserRole::Owner);
        $target = $this->person();
        $this->assertFalse($target->subscription_exempt);

        $this->actingAs($owner, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$target->uuid}", [
                'role' => 'moderator',
                'subscription_exempt' => false,
                'free_listings_quota' => 0,
            ])
            ->assertOk()
            ->assertJsonPath('data.subscription_exempt', false)
            ->assertJsonPath('data.free_listings_unlimited', true);
    }

    public function test_only_the_owner_edits_privileges(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $target = $this->person();

        foreach (['subscription_exempt' => true, 'free_listings_quota' => 5, 'free_listings_unlimited' => true, 'free_listings_used' => 0] as $field => $value) {
            $this->actingAs($moderator, 'sanctum')
                ->patchJson("/api/v1/admin/users/{$target->uuid}", [$field => $value])
                ->assertForbidden();
        }
        $this->assertFalse($target->fresh()->subscription_exempt);
    }

    public function test_exemption_opens_subscription_gated_actions_regardless_of_role(): void
    {
        $exempt = $this->person(UserRole::User, ['subscription_exempt' => true]);
        $channel = Channel::create(['owner_id' => $exempt->id, 'name' => 'К', 'slug' => 'k-'.uniqid(), 'kind' => 'author', 'comments_enabled' => true]);
        $this->actingAs($exempt, 'sanctum')
            ->postJson("/api/v1/channels/{$channel->slug}/posts", ['text' => 'Запись'])
            ->assertSuccessful();

        // Модератор, у которого Владелец снял льготу, упирается в подписку.
        $moderator = $this->person(UserRole::Moderator);
        $moderator->forceFill(['subscription_exempt' => false])->save();
        $own = Channel::create(['owner_id' => $moderator->id, 'name' => 'М', 'slug' => 'm-'.uniqid(), 'kind' => 'author', 'comments_enabled' => true]);
        $this->actingAs($moderator->fresh(), 'sanctum')
            ->postJson("/api/v1/channels/{$own->slug}/posts", ['text' => 'Запись'])
            ->assertForbidden()
            ->assertJsonPath('code', 'subscription_required');
    }

    public function test_migration_gives_existing_staff_their_role_defaults(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);
        $user = $this->person();
        DB::table('users')->update(['subscription_exempt' => false, 'free_listings_unlimited' => false]);

        $migration = require database_path('migrations/2026_09_19_140000_user_privileges_and_personal_quota.php');
        $migration->down();
        $migration->up();

        $this->assertTrue($owner->fresh()->subscription_exempt);
        $this->assertTrue($moderator->fresh()->free_listings_unlimited);
        $this->assertFalse($user->fresh()->subscription_exempt);
    }

    public function test_owner_grants_and_withdraws_listing_credits_with_a_reason(): void
    {
        $owner = $this->person(UserRole::Owner);
        $target = $this->person();

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/users/{$target->uuid}/listing-credits", ['amount' => 3, 'reason' => 'Компенсация'])
            ->assertOk()
            ->assertJsonPath('data.listing_placement_credits', 3);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/users/{$target->uuid}/listing-credits", ['amount' => -5, 'reason' => 'Ошибка'])
            ->assertStatus(422);
        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/admin/users/{$target->uuid}/listing-credits", ['amount' => -1, 'reason' => 'Ошибка начисления'])
            ->assertOk()
            ->assertJsonPath('data.listing_placement_credits', 2);

        $this->assertSame(2, (int) $target->fresh()->listing_placement_credits);
        $this->assertSame(2, DB::table('bonus_transactions')->where('account_user_id', $target->id)->where('type', 'admin_grant')->count());
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'admin.users.listing_credits')->count());

        $this->actingAs($this->person(UserRole::Moderator), 'sanctum')
            ->postJson("/api/v1/admin/users/{$target->uuid}/listing-credits", ['amount' => 1, 'reason' => 'Хочу'])
            ->assertForbidden();
    }

    public function test_payment_history_explains_a_placement_that_became_a_credit(): void
    {
        $user = $this->person();
        foreach ([
            ['payable_type' => 'listing_placement'],
            ['payable_type' => 'listing_placement', 'listing_uuid' => (string) Str::uuid(), 'granted_listing_credit' => false],
            ['payable_type' => 'subscription'],
        ] as $i => $metadata) {
            Payment::query()->create([
                'uuid' => (string) Str::uuid(),
                'user_id' => $user->id,
                'amount_cents' => 2000,
                'currency' => 'RUB',
                'status' => 'paid',
                'provider' => 'stub',
                'idempotency_key' => 'k-'.$i.'-'.uniqid(),
                'paid_at' => now()->subMinutes(10 - $i),
                'metadata' => $metadata,
                'created_at' => now()->subMinutes(10 - $i),
            ]);
        }

        $rows = $this->actingAs($user, 'sanctum')->getJson('/api/v1/users/me/payments')->assertOk()->json('data');
        $flags = collect($rows)->pluck('granted_listing_credit')->all();

        // Новые сверху: подписка, привязанная оплата, оплата без объявления.
        $this->assertSame([false, false, true], $flags);
    }
}
