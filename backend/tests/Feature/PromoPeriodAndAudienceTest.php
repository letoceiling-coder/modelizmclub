<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\EmailVerificationCode;
use App\Models\Promocode;
use App\Models\PromoPool;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Auth\Services\EmailVerificationService;
use Modules\Billing\Services\PromocodeService;
use Tests\TestCase;

/**
 * Период акции и круг тех, кому она доступна.
 *
 * Все проверки — про выдачу, а не про вид экрана: спрятанная кнопка
 * ничего не запрещает, и пункт «сервер проверяет, а не прячет» здесь
 * такой же, как в ролях.
 */
class PromoPeriodAndAudienceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SubscriptionPlan::query()->create([
            'slug' => 'year',
            'name' => 'Год',
            'price_cents' => 79900,
            'period_days' => 365,
            'sort_order' => 1,
            'is_active' => true,
        ]);
    }

    public function test_pool_that_has_not_started_gives_no_seats_and_starts_by_itself(): void
    {
        $pool = $this->pool([
            'starts_at' => now()->addDays(3),
            'expires_at' => now()->addYear(),
        ]);

        $this->assertSame(PromoPool::STATE_PLANNED, $pool->state());

        $ранний = $this->verifyNewUser();
        $this->assertFalse($ранний->is_first_hundred, 'Запланированная акция не должна раздавать места.');

        // Ничего не включаем руками: наступает дата — акция идёт.
        $this->travelTo(now()->addDays(4));

        $this->assertSame(PromoPool::STATE_ACTIVE, $pool->fresh()->state());
        $поздний = $this->verifyNewUser();
        $this->assertTrue($поздний->is_first_hundred);
    }

    public function test_pool_finishes_by_itself_when_the_term_runs_out(): void
    {
        $pool = $this->pool(['expires_at' => now()->addDay()]);

        $this->travelTo(now()->addDays(2));

        $this->assertSame(PromoPool::STATE_COMPLETED, $pool->fresh()->state());
        $this->assertFalse($this->verifyNewUser()->is_first_hundred);
    }

    public function test_pool_for_selected_people_skips_everyone_else(): void
    {
        $pool = $this->pool([
            'audience' => PromoPool::AUDIENCE_SELECTED,
            'starts_at' => now()->subDay(),
            'expires_at' => now()->addYear(),
        ]);

        $чужой = $this->verifyNewUser();
        $this->assertFalse($чужой->is_first_hundred, 'Человек вне круга не должен получать место.');

        $свой = $this->makeUser();
        $pool->audienceUsers()->sync([$свой->id => ['created_at' => now()]]);

        $this->verifyEmail($свой);
        $this->assertTrue($свой->fresh()->is_first_hundred);

        // Место ушло одному, а не двоим: чужой его не занял даже вхолостую.
        $this->assertSame(1, (int) $pool->fresh()->current_activations);
    }

    public function test_pool_for_new_users_skips_those_registered_before_the_start(): void
    {
        $старый = $this->makeUser(['created_at' => now()->subMonth()]);

        $this->pool([
            'audience' => PromoPool::AUDIENCE_NEW,
            'starts_at' => now()->subDay(),
            'expires_at' => now()->addYear(),
        ]);

        $this->verifyEmail($старый);
        $this->assertFalse($старый->fresh()->is_first_hundred);

        $новый = $this->verifyNewUser();
        $this->assertTrue($новый->is_first_hundred);
    }

    public function test_seats_cannot_be_lowered_below_what_is_already_granted(): void
    {
        $pool = $this->pool(['expires_at' => now()->addYear()]);
        $this->verifyNewUser();
        $this->assertSame(1, (int) $pool->fresh()->current_activations);

        $admin = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/promo-pools/{$pool->uuid}", ['max_activations' => 0])
            ->assertStatus(422);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/promo-pools/{$pool->uuid}", ['max_activations' => 50])
            ->assertOk()
            ->assertJsonPath('data.max_activations', 50)
            ->assertJsonPath('data.seats_left', 49)
            ->assertJsonPath('data.state', PromoPool::STATE_ACTIVE);
    }

    public function test_start_after_finish_is_refused(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/promo-pools', [
                'name' => 'Задом наперёд',
                'max_activations' => 10,
                'starts_at' => now()->addMonths(2)->toDateTimeString(),
                'expires_at' => now()->addMonth()->toDateTimeString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['starts_at']);
    }

    public function test_promocode_limited_to_selected_people_is_refused_for_everyone_else(): void
    {
        $promo = Promocode::query()->create([
            'code' => 'ТОЛЬКОСВОИ',
            'type' => 'percent',
            'scope' => 'all',
            'value' => 50,
            'is_active' => true,
        ]);

        $свой = $this->makeUser();
        $чужой = $this->makeUser();
        DB::table('promocode_users')->insert([
            'promocode_id' => $promo->id,
            'user_id' => $свой->id,
            'created_at' => now(),
        ]);

        $service = app(PromocodeService::class);

        // Свой проходит, чужой получает отказ — проверка на сервере, а не
        // в том, показали ли кнопку.
        $this->assertSame($promo->id, $service->findValid('ТОЛЬКОСВОИ', $свой, 'all')->id);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->findValid('ТОЛЬКОСВОИ', $чужой, 'all');
    }

    public function test_promocode_without_a_list_stays_available_to_everyone(): void
    {
        Promocode::query()->create([
            'code' => 'ВСЕМ',
            'type' => 'percent',
            'scope' => 'all',
            'value' => 10,
            'is_active' => true,
        ]);

        $кто_угодно = $this->makeUser();
        $this->assertSame('ВСЕМ', app(PromocodeService::class)->findValid('ВСЕМ', $кто_угодно, 'all')->code);
    }

    public function test_admin_search_finds_a_person_by_a_phone_written_differently(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Owner, 'status' => UserStatus::Active]);
        $человек = $this->makeUser(['phone' => '+7 (999) 123-45-67']);

        foreach (['9991234567', '8 999 123 45 67', '+79991234567', '123-45-67'] as $набрано) {
            $ответ = $this->actingAs($admin, 'sanctum')
                ->getJson('/api/v1/admin/users?q='.urlencode($набрано))
                ->assertOk()
                ->json('data');

            $this->assertContains(
                $человек->id,
                array_column($ответ, 'id'),
                "По запросу «{$набрано}» человек не нашёлся.",
            );
        }
    }

    /** @param  array<string, mixed>  $поля */
    private function pool(array $поля = []): PromoPool
    {
        return PromoPool::query()->create(array_merge([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'name' => 'Акция',
            'max_activations' => 100,
            'current_activations' => 0,
            'expires_at' => now()->addYear(),
            'is_active' => true,
            'auto_assign_on_register' => true,
            'audience' => PromoPool::AUDIENCE_ALL,
            'plan_slug' => 'year',
            'bonus_kopecks' => 0,
        ], $поля));
    }

    /** @param  array<string, mixed>  $поля */
    private function makeUser(array $поля = []): User
    {
        $user = User::factory()->create(array_merge([
            'status' => UserStatus::PendingVerification,
            'email_verified_at' => null,
            'is_first_hundred' => false,
            'promo_pool_id' => null,
        ], $поля));

        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Promo User',
            'slug' => 'promo-'.uniqid(),
        ]);

        return $user;
    }

    private function verifyEmail(User $user): void
    {
        app(EmailVerificationService::class)->issueCode($user);
        $code = EmailVerificationCode::query()->where('user_id', $user->id)->value('code');
        $this->assertNotNull($code);

        $this->postJson('/api/v1/auth/verify-email', [
            'email' => $user->email,
            'code' => $code,
        ])->assertOk();
    }

    private function verifyNewUser(): User
    {
        $user = $this->makeUser();
        $this->verifyEmail($user);

        return $user->fresh();
    }
}
