<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\AdminAccess;
use App\Support\RoleAccessOverrides;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * «Что открывает роль» правится из админки, и сервер слушается настройки.
 *
 * До 28.09 состав разделов у роли задавался константой `AdminAccess::SECTIONS`:
 * поменять его можно было только правкой кода и выкаткой, а раздел в админке
 * показывал карту галочками и ничего не позволял.
 *
 * Главное здесь — не то, что галочка сохранилась, а что **сервер закрыл
 * доступ по-настоящему**. Поэтому проверка идёт запросом к охраняемому
 * маршруту, а не сравнением того, что вернула сводка: спрятать раздел в меню
 * и закрыть его — разные вещи, и в этом коде они уже расходились (17.09
 * заявки сообществ сервер модератору отдавал, а меню прятало).
 */
class AdminRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RoleAccessOverrides::forget();
    }

    protected function tearDown(): void
    {
        RoleAccessOverrides::forget();
        parent::tearDown();
    }

    private function человек(UserRole $role, string $имя = 'Человек'): User
    {
        $user = User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'name' => $имя,
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => $имя,
            'slug' => Str::slug($имя).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    /** Действующая карта — как её отдаёт сводка. */
    private function карта(User $owner): array
    {
        return $this->actingAs($owner, 'sanctum')
            ->getJson('/api/v1/admin/roles')
            ->assertOk()
            ->json('data.role_access');
    }

    private function сохранить(User $owner, array $карта): TestResponse
    {
        $ответ = $this->actingAs($owner, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => $карта]);

        // Настройка читается из памятки в пределах запроса; следующий запрос
        // в тесте идёт в том же процессе, поэтому памятку сбрасываем сами.
        RoleAccessOverrides::forget();

        return $ответ;
    }

    /**
     * Снятый доступ закрыт на сервере, а не спрятан в меню.
     *
     * Доставка — раздел модератора по зашитой карте. Снимаем её у роли и
     * стучимся в охраняемый маршрут тем же токеном.
     */
    public function test_снятый_доступ_закрывает_маршрут(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        // До правки — открыто.
        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/delivery/methods')
            ->assertOk();

        $карта = $this->карта($owner);
        $карта['moderator']['delivery'] = false;
        $this->сохранить($owner, $карта)->assertOk();

        // После правки — 403 от сервера, а не отсутствие пункта в меню.
        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/delivery/methods')
            ->assertForbidden();

        // И раздела нет в ответе /admin/access, из которого строится меню.
        $разделы = $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/access')->assertOk()->json('data.sections');
        $this->assertNotContains('delivery', $разделы);
    }

    /**
     * Выданный доступ открывает маршрут, которого у роли не было.
     *
     * Мероприятия — раздел Владельца. Открываем его роли модератора и
     * проверяем, что маршрут отвечает, а не только галочка стоит.
     */
    public function test_выданный_доступ_открывает_маршрут(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/events')
            ->assertForbidden();

        $карта = $this->карта($owner);
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/events')
            ->assertOk();
    }

    /**
     * Три роли правятся отдельно друг от друга.
     *
     * Зашитая карта ранговая, и при правке ступени одно нажатие меняло бы
     * соседние столбцы. Исключения адресные, поэтому «открыл администратору
     * направления» не значит «открыл и модератору».
     */
    public function test_роли_правятся_отдельно(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');
        $категорийный = $this->человек(UserRole::CategoryAdmin, 'Админ направления');

        $карта = $this->карта($owner);
        $карта['category_admin']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        $this->actingAs($категорийный, 'sanctum')->getJson('/api/v1/admin/events')->assertOk();
        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/events')
            ->assertForbidden();
        // И у Владельца ничего не отобралось.
        $this->actingAs($owner, 'sanctum')->getJson('/api/v1/admin/events')->assertOk();
    }

    /**
     * Роли людей не слетают.
     *
     * Правка карты не пишет `users.role` вовсе, и это главное обещание
     * задания. Проверяется на всех трёх сотрудниках и на обычном человеке.
     */
    public function test_роли_людей_не_меняются(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');
        $второй = $this->человек(UserRole::Moderator, 'Второй модератор');
        $категорийный = $this->человек(UserRole::CategoryAdmin, 'Админ направления');
        $обычный = $this->человек(UserRole::User, 'Обычный');

        $карта = $this->карта($owner);
        $карта['moderator']['delivery'] = false;
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        foreach ([
            [$owner, UserRole::Owner],
            [$moderator, UserRole::Moderator],
            [$второй, UserRole::Moderator],
            [$категорийный, UserRole::CategoryAdmin],
            [$обычный, UserRole::User],
        ] as [$человек, $роль]) {
            $this->assertSame($роль, $человек->fresh()->role, "роль {$человек->name} изменилась");
        }
    }

    /** Правка у роли применяется ко всем её носителям, а не к одному. */
    public function test_правка_применяется_ко_всем_модераторам(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $первый = $this->человек(UserRole::Moderator, 'Первый');
        $второй = $this->человек(UserRole::Moderator, 'Второй');

        $карта = $this->карта($owner);
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        $this->actingAs($первый, 'sanctum')->getJson('/api/v1/admin/events')->assertOk();
        $this->actingAs($второй, 'sanctum')->getJson('/api/v1/admin/events')->assertOk();
    }

    /**
     * Права, выданные человеку лично (C3), правку роли переживают.
     *
     * Иначе снятие раздела у роли молча отбирало бы и то, что этому
     * конкретному сотруднику выдали отдельным решением.
     */
    public function test_личная_выдача_переживает_снятие_у_роли(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/v1/admin/roles/permissions/{$moderator->uuid}", ['sections' => ['delivery']])
            ->assertOk();

        $карта = $this->карта($owner);
        $карта['moderator']['delivery'] = false;
        $this->сохранить($owner, $карта)->assertOk();

        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/delivery/methods')
            ->assertOk();
    }

    /**
     * `roles` у Владельца снять нельзя.
     *
     * Это единственная дверь к правке самой карты: сняв её, человек лишает
     * себя возможности вернуть что-либо, и починка была бы только правкой
     * базы руками.
     */
    public function test_владельцу_нельзя_снять_доступ_к_правке_прав(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');

        $карта = $this->карта($owner);
        $карта['owner']['roles'] = false;
        $this->сохранить($owner, $карта)->assertOk();

        // Клетка заперта: снятие просто не произошло.
        $this->assertTrue($this->карта($owner)['owner']['roles']);
        $this->actingAs($owner, 'sanctum')->getJson('/api/v1/admin/roles')->assertOk();
    }

    /** В журнал уходит, что именно изменилось, а не «карта изменена». */
    public function test_в_журнале_видно_каждую_клетку(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');

        $карта = $this->карта($owner);
        $карта['moderator']['delivery'] = false;
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        $запись = AuditLog::query()->where('action', 'admin.roles.access')->latest('created_at')->first();
        $this->assertNotNull($запись, 'правка карты обязана оставить след');

        $клетки = collect($запись->new_values['changed'])
            ->mapWithKeys(fn (array $c) => [$c['role'].'.'.$c['key'] => $c])
            ->all();

        $this->assertArrayHasKey('moderator.delivery', $клетки);
        $this->assertTrue($клетки['moderator.delivery']['from']);
        $this->assertFalse($клетки['moderator.delivery']['to']);

        $this->assertArrayHasKey('moderator.events', $клетки);
        $this->assertFalse($клетки['moderator.events']['from']);
        $this->assertTrue($клетки['moderator.events']['to']);
    }

    /**
     * В настройке лежат только отличия.
     *
     * Если бы записывалась присланная карта целиком, следующая правка
     * умолчаний в коде перестала бы что-либо менять: настройка перебивала бы
     * её по всем сорока ключам.
     */
    public function test_в_настройке_только_отличия(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');

        $карта = $this->карта($owner);
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();

        $this->assertSame(['moderator' => ['events' => true]], RoleAccessOverrides::all());
    }

    /** Возврат галочки в прежнее положение убирает исключение из настройки. */
    public function test_возврат_к_умолчанию_чистит_настройку(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');

        $карта = $this->карта($owner);
        $карта['moderator']['events'] = true;
        $this->сохранить($owner, $карта)->assertOk();
        $this->assertNotSame([], RoleAccessOverrides::all());

        $карта = $this->карта($owner);
        $карта['moderator']['events'] = false;
        $this->сохранить($owner, $карта)->assertOk();

        $this->assertSame([], RoleAccessOverrides::all(), 'исключение должно уйти, а не остаться false');
    }

    /** Правит только Владелец. */
    public function test_модератор_карту_не_правит(): void
    {
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        $this->actingAs($moderator, 'sanctum')
            ->putJson('/api/v1/admin/roles/access', ['access' => ['moderator' => ['events' => true]]])
            ->assertForbidden();
    }

    /**
     * Неизвестный ключ ничего не открывает.
     *
     * Настройка живёт в `system_settings`, и туда пишет не только этот код.
     * Строка от переименованного раздела не должна ни открывать доступ, ни
     * ронять проверку.
     */
    public function test_неизвестный_ключ_игнорируется(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        $this->сохранить($owner, [
            'moderator' => ['takogo-razdela-net' => true],
            'chuzhaya_rol' => ['events' => true],
        ])->assertOk();

        $this->assertSame([], RoleAccessOverrides::all());
        $this->assertFalse(AdminAccess::allows($moderator->fresh(), 'takogo-razdela-net'));
    }

    /**
     * Присланная карта без ключа не снимает доступ по этому ключу.
     *
     * Экран мог не знать про ключ, добавленный в код позже его загрузки.
     * Считать отсутствующую клетку закрытой значило бы молча снять доступ по
     * тому, чего человек не видел и не трогал.
     */
    public function test_отсутствующая_клетка_не_снимает_доступ(): void
    {
        $owner = $this->человек(UserRole::Owner, 'Владелец');
        $moderator = $this->человек(UserRole::Moderator, 'Модератор');

        $this->сохранить($owner, ['moderator' => ['events' => true]])->assertOk();

        // Доставку не присылали вовсе — она должна остаться открытой.
        $this->actingAs($moderator, 'sanctum')
            ->getJson('/api/v1/admin/delivery/methods')
            ->assertOk();
    }
}
