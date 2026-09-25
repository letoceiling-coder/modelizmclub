<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Учётки приёмки: три состояния доступа и признак, переживающий уборку.
 */
class QaAccountsTest extends TestCase
{
    use RefreshDatabase;

    /** Тариф нужен подписчику: `plan_id` в user_subscriptions обязателен. */
    private function тариф(): void
    {
        if (DB::table('subscription_plans')->count() > 0) {
            return;
        }
        DB::table('subscription_plans')->insert([
            'slug' => 'qa', 'name' => 'QA', 'price_cents' => 0, 'period_days' => 365,
            'max_photos_per_post' => 10, 'free_listings_per_month' => 0,
            'listing_discount_percent' => 0, 'priority_boost' => 0,
            'is_active' => true, 'sort_order' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->тариф();
    }

    public function test_it_creates_three_states(): void
    {
        $this->artisan('qa:seed-accounts')->assertSuccessful();

        $без = User::query()->where('email', 'qa-registered@qa.modelizmclub.ru')->first();
        $с = User::query()->where('email', 'qa-verified@qa.modelizmclub.ru')->first();
        $подписка = User::query()->where('email', 'qa-subscriber@qa.modelizmclub.ru')->first();

        $this->assertNotNull($без);
        $this->assertNull($без->phone_verified_at, 'без SMS — телефон не подтверждён');

        $this->assertNotNull($с);
        $this->assertNotNull($с->phone_verified_at, 'с SMS — телефон подтверждён');

        $this->assertNotNull($подписка);
        $this->assertSame(1, DB::table('user_subscriptions')
            ->where('user_id', $подписка->id)->where('status', 'active')->count());
    }

    /** Признак отдельный от имени — имя затирается, он нет. */
    public function test_every_account_carries_the_flag(): void
    {
        $this->artisan('qa:seed-accounts')->assertSuccessful();

        $this->assertSame(3, User::query()->where('is_qa_account', true)->count());
    }

    public function test_dry_run_creates_nothing(): void
    {
        $this->artisan('qa:seed-accounts', ['--dry-run' => true])
            ->expectsOutputToContain('Сухой прогон')
            ->assertSuccessful();

        $this->assertSame(0, User::query()->where('is_qa_account', true)->count());
    }

    /** Повтор не плодит учётки, а выдаёт новый токен взамен прежних. */
    public function test_running_twice_reissues_instead_of_duplicating(): void
    {
        $this->artisan('qa:seed-accounts')->assertSuccessful();
        $первый = User::query()->where('email', 'qa-verified@qa.modelizmclub.ru')->first();
        $this->assertSame(1, $первый->tokens()->count());

        $this->artisan('qa:seed-accounts')->assertSuccessful();

        $this->assertSame(3, User::query()->where('is_qa_account', true)->count());
        $this->assertSame(1, $первый->fresh()->tokens()->count(), 'старый токен должен быть отозван');
    }

    /**
     * Уборка не должна повторить 25.09.
     *
     * Тогда обезличили все три учётки приёмки, и проверять состояния
     * доступа стало нечем — а опознать их потом было не по чему.
     */
    public function test_anonymize_refuses_a_qa_account_without_force(): void
    {
        $this->artisan('qa:seed-accounts')->assertSuccessful();
        $user = User::query()->where('is_qa_account', true)->first();

        $this->artisan('users:anonymize', ['users' => [$user->id]])
            ->expectsOutputToContain('учётка приёмки')
            ->assertFailed();

        $this->assertSame('qa-registered@qa.modelizmclub.ru', $user->fresh()->email);
    }

    /** С явным --force обезличить всё-таки можно: запрет не должен быть тупиком. */
    public function test_force_still_anonymizes(): void
    {
        $this->artisan('qa:seed-accounts')->assertSuccessful();
        $user = User::query()->where('is_qa_account', true)->first();

        $this->artisan('users:anonymize', ['users' => [$user->id], '--force' => true])
            ->assertSuccessful();

        $this->assertStringContainsString('@removed.invalid', $user->fresh()->email);
    }
}
