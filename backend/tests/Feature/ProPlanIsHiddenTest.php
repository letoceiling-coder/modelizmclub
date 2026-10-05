<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Support\SwaggerFixtures;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Тариф Pro скрыт и не покупается. Решение владельца от 04.10.
 *
 * Два утверждения, и второе важнее первого: спрятать тариф в списке —
 * это про экран, а запретить покупку — про сервер. Клиент можно обойти
 * прямым запросом, поэтому проверяется именно отказ сервера.
 *
 * Тариф создаётся здесь, а не берётся из семян: проверка не должна
 * зависеть от того, что кто-то когда-то засеял строку с таким именем.
 */
final class ProPlanIsHiddenTest extends TestCase
{
    use RefreshDatabase;

    private function тариф(string $slug, bool $активен, int $цена = 49900): SubscriptionPlan
    {
        return SubscriptionPlan::query()->create([
            'slug' => $slug,
            'name' => 'Тариф '.$slug,
            'price_cents' => $цена,
            'period_days' => 30,
            'is_active' => $активен,
            'sort_order' => 1,
        ]);
    }

    public function test_pro_is_absent_from_the_public_list(): void
    {
        $this->тариф('pro', false);
        $this->тариф('year', true, 79900);

        $ответ = $this->getJson('/api/v1/plans')->assertOk();

        $slugs = collect($ответ->json('data'))->pluck('slug')->all();

        self::assertNotContains('pro', $slugs, 'скрытый тариф попал в публичный список');
        self::assertContains('year', $slugs, 'видимый тариф из списка пропал — проверка меряет не то');
    }

    public function test_pro_cannot_be_bought_by_a_direct_request(): void
    {
        $this->тариф('pro', false);
        $человек = User::factory()->create(['role' => UserRole::User]);

        $this->actingAs($человек, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'pro'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('plan_slug');
    }

    /**
     * Семена не возвращают тариф обратно в продажу.
     *
     * Миграция правит строку, которая уже есть. Но `pro` заводится семенем
     * как образец для Swagger, и пока семя ставило `is_active => true`,
     * свежая установка снова выставляла его в общий список за 499 рублей.
     * Правка одних только данных закрыла бы прод и оставила дыру в
     * установке с нуля.
     */
    public function test_seeding_from_scratch_keeps_pro_hidden(): void
    {
        $this->seed(ReferenceDataSeeder::class);

        $pro = SubscriptionPlan::query()->where('slug', SwaggerFixtures::PLAN_PRO_SLUG)->first();

        self::assertNotNull($pro, 'образец pro пропал — проверка меряет не то');
        self::assertFalse((bool) $pro->is_active, 'семена завели pro видимым');

        $slugs = collect($this->getJson('/api/v1/plans')->json('data'))->pluck('slug')->all();
        self::assertNotContains('pro', $slugs);
    }

    /**
     * Доказательство, что предыдущая проверка способна провалиться.
     *
     * Без неё отказ на `pro` ничего не значил бы: он мог бы приходить
     * любому тарифу — например, если сломана оплата целиком.
     */
    public function test_an_open_plan_is_still_bought(): void
    {
        $this->тариф('year', true, 79900);
        $человек = User::factory()->create(['role' => UserRole::User]);

        $ответ = $this->actingAs($человек, 'sanctum')
            ->postJson('/api/v1/payments', ['plan_slug' => 'year']);

        self::assertNotSame(
            422,
            $ответ->getStatusCode(),
            'открытый тариф тоже не покупается — значит отказ на pro ничего не доказывает',
        );
    }
}
