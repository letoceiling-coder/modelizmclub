<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Support\AdminAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Раздел, предложенный роли, этой ролью открывается.
 *
 * ЧТО БЫЛО НЕ ТАК. `SECTIONS['dashboard'] = 'moderator'` — значит пункт
 * «Сводка» стоял у каждого модератора в меню. А единственный маршрут за
 * ним, `GET /admin/dashboard`, охранялся служебным ключом
 * `dashboard.full` со значением `owner`. Модератор нажимал пункт и
 * получал 403. Проверено запросом к проду 29.09 под учёткой 1207.
 *
 * Денег в сводке при этом нет вовсе — девять счётчиков и график
 * регистраций, — то есть владельческий замок стоял на данных, которых он
 * не защищает.
 *
 * ПОЧЕМУ ЭТО ПРОЖИЛО. Проверка была ровно обратная: «каждое выдаваемое
 * право что-то охраняет» (`AdminPermissionGrantsTest`). Она ловит
 * галочку, которая ничего не даёт. Обратный случай — раздел, который
 * ничего не открывает, — не ловил никто.
 *
 * ЧТО ИМЕННО ТРЕБУЕТСЯ. Не «у каждого раздела есть маршрут»: у вкладок
 * вроде `analytics` и `design` своих маршрутов нет вовсе, они читают
 * чужие, и это нормально. Требование мягче и точнее: **если** у раздела
 * есть свои маршруты, то хотя бы один из них должен открываться той
 * ролью, которой раздел показан. Иначе меню обещает то, чего нет.
 *
 * `users` этому удовлетворяет: `users.manage` строже роли, но сам
 * `GET /admin/users` открыт модератору. Строгий ключ внутри раздела —
 * не дефект; дефект — когда строгими оказались все.
 */
class EverySectionOpensForItsRoleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ключи `admin.section:*`, которыми охраняются маршруты.
     *
     * @return list<string>
     */
    private function охраняемыеКлючи(): array
    {
        $ключи = [];

        foreach (Route::getRoutes() as $маршрут) {
            foreach ($маршрут->gatherMiddleware() as $слой) {
                if (is_string($слой) && str_starts_with($слой, 'admin.section:')) {
                    $ключи[] = substr($слой, strlen('admin.section:'));
                }
            }
        }

        return array_values(array_unique($ключи));
    }

    public function test_у_каждого_раздела_есть_маршрут_по_силам_его_роли(): void
    {
        $ключи = $this->охраняемыеКлючи();
        $this->assertNotEmpty($ключи, 'маршруты не собрались — проверка ничего не проверяет');

        $беда = [];

        foreach (AdminAccess::SECTIONS as $раздел => $уровеньРаздела) {
            // Свои маршруты раздела: сам ключ и служебные вида «раздел.что-то».
            $свои = array_filter(
                $ключи,
                static fn (string $к) => $к === $раздел || str_starts_with($к, $раздел.'.'),
            );

            if ($свои === []) {
                // Вкладка без своих маршрутов — читает чужие. Не наш случай.
                continue;
            }

            // Что эта роль вообще может: ключи считает сам AdminAccess,
            // с учётом настройки из админки, а не только рангов.
            $поСилам = AdminAccess::keysForRole($уровеньРаздела);
            $открывается = array_intersect($свои, $поСилам) !== [];

            if (! $открывается) {
                $беда[] = "{$раздел} (роль {$уровеньРаздела}): все маршруты строже — ".implode(', ', $свои);
            }
        }

        $this->assertSame([], $беда, "раздел показан роли, но ей не открывается:\n".implode("\n", $беда));
    }

    public function test_модератор_открывает_сводку(): void
    {
        $moderator = User::factory()->create([
            'role' => UserRole::Moderator,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure(['data' => ['users_total', 'registrations_daily']]);
    }

    public function test_обычному_человеку_сводка_закрыта(): void
    {
        // Контроль: иначе «модератору открылось» могло бы означать
        // «открылось всем».
        $человек = User::factory()->create([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($человек, 'sanctum')
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();
    }

    public function test_владельческие_разделы_модератору_по_прежнему_закрыты(): void
    {
        // Второй контроль: правка открыла сводку, а не админку целиком.
        $moderator = User::factory()->create([
            'role' => UserRole::Moderator,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);

        foreach (['/api/v1/admin/settings', '/api/v1/admin/ledger/totals', '/api/v1/admin/audit-logs'] as $путь) {
            $this->actingAs($moderator, 'sanctum')->getJson($путь)->assertForbidden();
        }
    }
}
