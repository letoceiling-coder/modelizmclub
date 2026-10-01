<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Список акций достаёт до всех, а не до первых двадцати.
 *
 * Размер страницы был константой `20`, и клиент брал первую страницу.
 * Пока список был только справкой, обрезание не бросалось в глаза; с
 * появлением правки двадцать первая акция стала недостижимой — правка и
 * удаление до неё не доставали, и ничто об этом не говорило.
 */
class AdminPromocodeListTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create([
            'role' => UserRole::Owner,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    private function завести(int $сколько): void
    {
        for ($i = 1; $i <= $сколько; $i++) {
            Promocode::query()->create([
                'code' => 'CODE'.$i,
                'type' => 'percent',
                'value' => 10,
                'max_usages' => 5,
                'is_active' => true,
            ]);
        }
    }

    public function test_размер_страницы_задаёт_запрос(): void
    {
        $admin = $this->owner();
        $this->завести(25);

        $ответ = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/promocodes?per_page=100');

        $ответ->assertOk();
        $this->assertCount(25, $ответ->json('data.data'), 'запрошенный размер страницы не услышан');
        $this->assertSame(1, (int) $ответ->json('data.last_page'));
    }

    public function test_без_запроса_страница_всё_равно_больше_двадцати(): void
    {
        $admin = $this->owner();
        $this->завести(25);

        $ответ = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/promocodes');

        $ответ->assertOk();
        // Умолчание — 50, как у категорий рядом: двадцать пять акций
        // укладываются в одну страницу и без просьбы.
        $this->assertCount(25, $ответ->json('data.data'));
    }

    public function test_страницы_вместе_дают_все_акции(): void
    {
        $admin = $this->owner();
        $this->завести(25);

        $коды = [];
        for ($страница = 1; $страница <= 3; $страница++) {
            $ответ = $this->actingAs($admin, 'sanctum')
                ->getJson("/api/v1/admin/promocodes?per_page=10&page={$страница}");
            $ответ->assertOk();
            foreach ($ответ->json('data.data') as $строка) {
                $коды[] = $строка['code'];
            }
        }

        $this->assertCount(25, array_unique($коды), 'обход страниц теряет или дублирует акции');
    }

    public function test_потолок_размера_страницы(): void
    {
        $admin = $this->owner();
        $this->завести(3);

        // Запрос на всю таблицу одним ответом не исполняется: клиент
        // обходит страницы сам, и неограниченный размер здесь не нужен.
        $ответ = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/promocodes?per_page=100000');

        $ответ->assertOk();
        $this->assertSame(200, (int) $ответ->json('data.per_page'), 'потолок размера страницы снят');
    }
}
