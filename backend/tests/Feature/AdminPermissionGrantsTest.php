<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermissionGrant;
use App\Models\PostCategory;
use App\Models\User;
use App\Support\AdminAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Tests\TestCase;

/**
 * Отдельные права поверх роли (C3).
 *
 * Роль — умолчание, галочка — надстройка: она добавляет раздел и никогда
 * не отнимает. Раздавать права может только Владелец по роли, и выдача не
 * должна становиться способом получить Владельца обходом.
 */
class AdminPermissionGrantsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        AdminPermissionGrant::forget();
    }

    private function person(UserRole $role = UserRole::User): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function grant(User $user, string ...$sections): void
    {
        foreach ($sections as $section) {
            AdminPermissionGrant::query()->create(['user_id' => $user->id, 'section' => $section]);
        }
        AdminPermissionGrant::forget();
    }

    public function test_право_добавляет_раздел_которого_роль_не_даёт(): void
    {
        $moderator = $this->person(UserRole::Moderator);

        // Журнал действий — раздел Владельца, модератору закрыт.
        $this->actingAs($moderator)->getJson('/api/v1/admin/audit-logs')->assertForbidden();

        $this->grant($moderator, 'auditLog');

        $this->actingAs($moderator)->getJson('/api/v1/admin/audit-logs')->assertOk();
    }

    public function test_право_видно_в_карте_доступа_отдельно_от_роли(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $this->grant($moderator, 'auditLog');

        $ответ = $this->actingAs($moderator)->getJson('/api/v1/admin/access');
        $ответ->assertOk();

        $this->assertContains('auditLog', $ответ->json('data.sections'));
        $this->assertSame(['auditLog'], $ответ->json('data.granted'));
        // Роль в ответе прежняя: галочка не делает человека Владельцем.
        $this->assertSame('moderator', $ответ->json('data.role'));
        $this->assertFalse($ответ->json('data.is_owner'));
    }

    public function test_права_нельзя_отнять_галочкой_то_что_даёт_роль(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $owner = $this->person(UserRole::Owner);

        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$moderator->uuid, ['sections' => []])
            ->assertOk();

        // Категории даёт роль модератора — и они остаются доступны.
        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/categories/post')->assertOk();
    }

    public function test_раздел_ролей_выдать_нельзя(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);

        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$moderator->uuid, ['sections' => ['roles']])
            ->assertStatus(422);

        $this->assertSame(0, AdminPermissionGrant::query()->count());
    }

    public function test_строка_с_невыдаваемым_ключом_ничего_не_открывает(): void
    {
        $moderator = $this->person(UserRole::Moderator);

        // Мимо ручки, прямо в таблицу: проверка стоит и на чтении.
        DB::table('admin_permission_grants')->insert([
            'user_id' => $moderator->id,
            'section' => 'roles',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        AdminPermissionGrant::forget();

        $this->actingAs($moderator)->getJson('/api/v1/admin/roles')->assertForbidden();
    }

    public function test_права_раздаёт_только_владелец_по_роли(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $другой = $this->person(UserRole::Moderator);

        // Даже с выданным доступом к разделу «Роли и доступ» — а он и не
        // выдаётся — раздавать права нельзя.
        $this->grant($moderator, 'auditLog');

        $this->actingAs($moderator)
            ->putJson('/api/v1/admin/roles/permissions/'.$другой->uuid, ['sections' => ['auditLog']])
            ->assertForbidden();
    }

    public function test_выдача_и_отзыв_пишутся_в_аудит(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);
        $адрес = '/api/v1/admin/roles/permissions/'.$moderator->uuid;

        $this->actingAs($owner)->putJson($адрес, ['sections' => ['auditLog']])->assertOk();
        $this->actingAs($owner)->putJson($адрес, ['sections' => []])->assertOk();

        $записи = DB::table('audit_logs')
            ->where('action', 'admin.roles.permissions')
            ->orderBy('id')
            ->get(['old_values', 'new_values']);

        $this->assertCount(2, $записи);
        $this->assertSame(['sections' => []], json_decode($записи[0]->old_values, true));
        $this->assertSame(['sections' => ['auditLog']], json_decode($записи[0]->new_values, true));
        $this->assertSame(['sections' => ['auditLog']], json_decode($записи[1]->old_values, true));
        $this->assertSame(['sections' => []], json_decode($записи[1]->new_values, true));
    }

    public function test_повтор_без_изменений_не_засоряет_аудит(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);
        $адрес = '/api/v1/admin/roles/permissions/'.$moderator->uuid;

        $this->actingAs($owner)->putJson($адрес, ['sections' => ['auditLog']])->assertOk();
        $this->actingAs($owner)->putJson($адрес, ['sections' => ['auditLog']])->assertOk();

        $this->assertSame(1, DB::table('audit_logs')->where('action', 'admin.roles.permissions')->count());
    }

    public function test_право_на_цены_открывает_именно_цены(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $направление = PostCategory::query()->create([
            'name' => 'Авиация', 'slug' => 'aviation', 'is_active' => true,
            'in_feed' => true, 'in_listings' => true, 'in_communities' => true,
        ]);
        app(CategoryTaxonomyService::class)->syncFromPostCategory($направление);
        $направление->refresh();

        $тело = [
            'name' => 'Авиация', 'slug' => 'aviation', 'is_active' => true,
            'listing_price_cents' => 50000,
        ];

        // Без права — отказ: это деньги площадки.
        $this->actingAs($moderator)
            ->patchJson('/api/v1/admin/categories/post/'.$направление->id, $тело)
            ->assertForbidden();

        $this->grant($moderator, 'categories.prices');

        $this->actingAs($moderator->fresh())
            ->patchJson('/api/v1/admin/categories/post/'.$направление->id, $тело)
            ->assertOk();
    }

    /**
     * Роль — не льгота. Право на учётные поля даёт менять почту и льготы,
     * но не раздавать роли: иначе им выдают себе Владельца.
     */
    public function test_право_на_учётные_поля_не_даёт_менять_роль(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $обычный = $this->person();
        $this->grant($moderator, 'users.fields');

        $this->actingAs($moderator->fresh())
            ->patchJson('/api/v1/admin/users/'.$обычный->uuid, ['subscription_exempt' => true])
            ->assertOk();

        $this->actingAs($moderator->fresh())
            ->patchJson('/api/v1/admin/users/'.$обычный->uuid, ['role' => 'owner'])
            ->assertForbidden();

        $this->assertSame(UserRole::User, $обычный->fresh()->role);
    }

    /**
     * Главная проверка задачи: ни одно выдаваемое право не делает
     * Владельца.
     *
     * Перебором, а не списком — новый ключ в SECTIONS или SERVICE
     * проскочил бы мимо перечисления молча. Ровно так и нашлась дыра:
     * `users.manage` был выдаваемым, а `POST /admin/users` писал роль как
     * есть, и обладатель галочки заводил себе вторую учётку Владельца.
     */
    public function test_ни_одно_выдаваемое_право_не_делает_владельца(): void
    {
        $жертва = $this->person(UserRole::Owner);
        $владельцевБыло = User::query()->where('role', UserRole::Owner)->count();

        foreach (AdminAccess::grantableKeys() as $ключ) {
            $moderator = $this->person(UserRole::Moderator);
            $this->grant($moderator, $ключ);
            $актёр = $moderator->fresh();

            // Завести себе учётку Владельца.
            $this->actingAs($актёр)->postJson('/api/v1/admin/users', [
                'email' => 'owner-'.str_replace('.', '-', $ключ).'@example.com',
                'password' => 'verysecret123',
                'role' => 'owner',
                'status' => 'active',
            ])->assertForbidden();

            // Выдать себе роль Владельца напрямую.
            $this->actingAs($актёр)
                ->patchJson('/api/v1/admin/users/'.$актёр->uuid, ['role' => 'owner'])
                ->assertForbidden();

            // Раздать права — себе или кому-то ещё.
            $this->actingAs($актёр)
                ->putJson('/api/v1/admin/roles/permissions/'.$актёр->uuid, ['sections' => ['auditLog']])
                ->assertForbidden();

            // Снести Владельца — второй ход исходной атаки: заведя себе
            // учётку Владельца, настоящих убирают по одному.
            $this->actingAs($актёр)
                ->deleteJson('/api/v1/admin/users/'.$жертва->uuid)
                ->assertForbidden();

            $this->assertFalse(
                AdminAccess::isOwner($актёр->fresh()),
                "право «{$ключ}» сделало Владельца",
            );
        }

        $this->assertSame(
            $владельцевБыло,
            User::query()->where('role', UserRole::Owner)->count(),
            'выдача прав завела новых Владельцев',
        );
        $this->assertNotNull($жертва->fresh(), 'выданное право позволило снести Владельца');
    }

    /**
     * Каждое выдаваемое право должно что-то открывать: либо охранять
     * маршрут, либо проверяться в коде явно. Иначе галочка выглядит
     * выданной, а страница отдаёт 403.
     */
    public function test_каждое_выдаваемое_право_что_то_охраняет(): void
    {
        // По зарегистрированным маршрутам, а не по тексту файла: поиск
        // подстроки прошёл бы и на закомментированной строке, и на
        // упоминании ключа в докблоке.
        $охраняемые = [];
        foreach (Route::getRoutes() as $маршрут) {
            foreach ($маршрут->gatherMiddleware() as $слой) {
                if (is_string($слой) && str_starts_with($слой, 'admin.section:')) {
                    $охраняемые[substr($слой, strlen('admin.section:'))] = true;
                }
            }
        }

        // Два ключа маршрутов не охраняют — их спрашивают в коде явно.
        $явные = ['categories.prices', 'users.fields'];

        foreach (AdminAccess::grantableKeys() as $ключ) {
            if (in_array($ключ, $явные, true)) {
                continue;
            }
            $this->assertArrayHasKey(
                $ключ,
                $охраняемые,
                "право «{$ключ}» не охраняет ни одного маршрута",
            );
        }
    }

    public function test_отзыв_закрывает_доступ(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);
        $адрес = '/api/v1/admin/roles/permissions/'.$moderator->uuid;

        $this->actingAs($owner)->putJson($адрес, ['sections' => ['auditLog']])->assertOk();
        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/audit-logs')->assertOk();

        $this->actingAs($owner)->putJson($адрес, ['sections' => []])->assertOk();
        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/audit-logs')->assertForbidden();
    }

    public function test_обычному_пользователю_права_не_выдаются(): void
    {
        $owner = $this->person(UserRole::Owner);
        $обычный = $this->person();

        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$обычный->uuid, ['sections' => ['auditLog']])
            ->assertStatus(422);

        $this->assertSame(0, AdminPermissionGrant::query()->count());
    }

    /** Понижение до обычного пользователя снимает доступ, даже если строки остались. */
    public function test_понижение_до_пользователя_закрывает_выданное(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $this->grant($moderator, 'auditLog');
        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/audit-logs')->assertOk();

        $moderator->forceFill(['role' => UserRole::User])->save();
        AdminPermissionGrant::forget();

        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/audit-logs')->assertForbidden();
        $this->actingAs($moderator->fresh())->getJson('/api/v1/admin/access')->assertForbidden();
    }

    public function test_отзыв_у_одного_не_трогает_другого(): void
    {
        $owner = $this->person(UserRole::Owner);
        $первый = $this->person(UserRole::Moderator);
        $второй = $this->person(UserRole::Moderator);

        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$первый->uuid, ['sections' => ['auditLog']])
            ->assertOk();
        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$второй->uuid, ['sections' => ['auditLog']])
            ->assertOk();

        $this->actingAs($owner)
            ->putJson('/api/v1/admin/roles/permissions/'.$первый->uuid, ['sections' => []])
            ->assertOk();

        $this->assertSame(['auditLog'], AdminAccess::grantsOf($второй->fresh()));
    }

    public function test_право_на_учётные_поля_не_даёт_править_сотрудников(): void
    {
        $moderator = $this->person(UserRole::Moderator);
        $другой = $this->person(UserRole::Moderator);
        $this->grant($moderator, 'users.fields');

        $this->actingAs($moderator->fresh())
            ->patchJson('/api/v1/admin/users/'.$другой->uuid, ['subscription_exempt' => true])
            ->assertForbidden();
    }

    public function test_сводка_ролей_отдаёт_выданное_и_выдаваемое(): void
    {
        $owner = $this->person(UserRole::Owner);
        $moderator = $this->person(UserRole::Moderator);
        $this->grant($moderator, 'auditLog');

        $ответ = $this->actingAs($owner)->getJson('/api/v1/admin/roles');
        $ответ->assertOk();

        $строка = collect($ответ->json('data.staff'))->firstWhere('uuid', $moderator->uuid);
        $this->assertSame(['auditLog'], $строка['granted_sections']);
        $this->assertContains('auditLog', $ответ->json('data.grantable_sections'));
        $this->assertNotContains('roles', $ответ->json('data.grantable_sections'));
    }
}
