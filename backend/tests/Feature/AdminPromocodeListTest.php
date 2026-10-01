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

            /*
             * Размер страницы проверяется здесь же, а не только итог
             * обхода. Прежняя версия складывала коды и сверяла сумму —
             * и проходила на старом коде: `paginate(20)` отдавал
             * 20 + 5 + 0 = те же двадцать пять. То есть утверждала
             * «обход ничего не теряет», ничего не говоря о том, услышан
             * ли `per_page`. Найдено ревью 01.10.
             */
            $this->assertSame(3, (int) $ответ->json('data.last_page'), 'страниц не три');
            $ждём = $страница === 3 ? 5 : 10;
            $this->assertCount($ждём, $ответ->json('data.data'), "страница {$страница}: размер");

            foreach ($ответ->json('data.data') as $строка) {
                $коды[] = $строка['code'];
            }
        }

        $this->assertCount(25, $коды, 'обход страниц дублирует акции');
        $this->assertCount(25, array_unique($коды), 'обход страниц теряет акции');
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

    public function test_негодный_размер_страницы_не_роняет_список(): void
    {
        $admin = $this->owner();
        $this->завести(3);

        foreach (['0', '-5', 'abc', ''] as $что) {
            $ответ = $this->actingAs($admin, 'sanctum')
                ->getJson("/api/v1/admin/promocodes?per_page={$что}");

            $ответ->assertOk();
            $this->assertGreaterThanOrEqual(
                1,
                (int) $ответ->json('data.per_page'),
                "per_page={$что}: размер страницы вышел недопустимым",
            );
        }
    }

    /**
     * Сортировка списка полна — то есть не зависит от везения.
     *
     * `created_at` в этой схеме без долей секунды: двадцать пять акций,
     * заведённых циклом, получают одно и то же время — замерено, одно
     * различное значение из пяти. При равных ключах порядок строк
     * Postgres не обещает, и он может отличаться между страницами:
     * тогда обход теряет одну акцию и показывает другую дважды.
     *
     * Воспроизвести это по требованию нельзя: на малой таблице строки
     * читаются в физическом порядке, и три прогона подряд совпали. Это
     * и есть причина проверять не совпадение двух обходов, а полноту
     * сортировки: совпадение — наблюдение, полнота — утверждение.
     * Ср. запись в known-issues про запас в 50 строк: там «работает
     * сейчас» тоже держалось на случайности.
     */
    public function test_сортировка_списка_полна(): void
    {
        $admin = $this->owner();
        $this->завести(25);

        $время = \Illuminate\Support\Facades\DB::table('promocodes')
            ->distinct()->count('created_at');
        $this->assertLessThan(25, $время, 'подготовка: время создания различается, совпадений нет');

        $sql = null;
        \Illuminate\Support\Facades\DB::listen(function ($query) use (&$sql): void {
            if (str_contains($query->sql, 'from "promocodes"') && str_contains($query->sql, 'order by')) {
                $sql = $query->sql;
            }
        });

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/promocodes?per_page=10')
            ->assertOk();

        $this->assertNotNull($sql, 'запрос списка не пойман — проверка смотрит не туда');
        $this->assertMatchesRegularExpression(
            '/order by .*"created_at".*"id"/i',
            $sql,
            'сортировка не полна: при равном времени порядок страниц ничем не закреплён',
        );
    }
}
