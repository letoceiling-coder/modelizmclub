<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Промокод правится, а не переводится.
 *
 * До 01.10 админка умела только создать и удалить: опечатку в сроке или
 * в проценте приходилось исправлять удалением и заводом заново. Вместе с
 * строкой уходила история применений — а она про деньги: кто и когда
 * применил код, это единственный способ разобрать спор о скидке.
 *
 * Маршрут `PUT /admin/promocodes/{code}` на сервере был и не вызывался
 * ниоткуда; здесь закрепляется, что правка сохраняет историю и что
 * занятый код объясняется словами, а не пятисоткой.
 */
class AdminPromocodeEditTest extends TestCase
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

    /** @param array<string, mixed> $patch */
    private function body(array $patch = []): array
    {
        return array_merge([
            'code' => 'SPRING25',
            'type' => 'percent',
            'scope' => 'listing_placement',
            'value' => 25,
            'max_usages' => 50,
            'valid_until' => now()->addDays(10)->toDateString(),
            'is_active' => true,
        ], $patch);
    }

    public function test_правка_сохраняет_историю_применений(): void
    {
        $admin = $this->owner();
        $покупатель = User::factory()->create();

        $promo = Promocode::query()->create($this->body(['value' => 10]));
        $promo->usages()->create(['user_id' => $покупатель->id, 'used_at' => now()]);

        $this->assertSame(1, $promo->usages()->count(), 'подготовка: применение записано');

        $ответ = $this->actingAs($admin, 'sanctum')->putJson(
            "/api/v1/admin/promocodes/{$promo->code}",
            $this->body(['value' => 30, 'valid_until' => now()->addDays(20)->toDateString()]),
        );

        $ответ->assertOk();
        $promo->refresh();

        $this->assertSame(30, (int) $promo->value, 'процент не изменился');
        $this->assertSame(
            1,
            $promo->usages()->count(),
            'история применений потеряна — ради этого правка и затевалась',
        );
        $this->assertSame($покупатель->id, (int) $promo->usages()->first()->user_id);
    }

    public function test_занятый_код_объясняется_словами_а_не_пятисоткой(): void
    {
        $admin = $this->owner();
        Promocode::query()->create($this->body(['code' => 'ZANYATO']));
        $свой = Promocode::query()->create($this->body(['code' => 'SVOY']));

        $ответ = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/promocodes/{$свой->code}", $this->body(['code' => 'ZANYATO']));

        $ответ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertSame('SVOY', $свой->fresh()->code, 'чужой код не присвоен');
    }

    public function test_свой_код_при_правке_не_считается_занятым(): void
    {
        $admin = $this->owner();
        $promo = Promocode::query()->create($this->body(['code' => 'SVOY', 'value' => 10]));

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/promocodes/SVOY", $this->body(['code' => 'SVOY', 'value' => 40]))
            ->assertOk();

        $this->assertSame(40, (int) $promo->fresh()->value);
    }

    public function test_создание_с_занятым_кодом_тоже_объясняется(): void
    {
        $admin = $this->owner();
        Promocode::query()->create($this->body(['code' => 'ZANYATO']));

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/promocodes', $this->body(['code' => 'ZANYATO']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_создание_со_свободным_кодом_по_прежнему_проходит(): void
    {
        $admin = $this->owner();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/promocodes', $this->body(['code' => 'SVOBODNO']))
            ->assertStatus(201);

        $this->assertDatabaseHas('promocodes', ['code' => 'SVOBODNO']);
    }

    public function test_правка_пишется_в_аудит(): void
    {
        $admin = $this->owner();
        $promo = Promocode::query()->create($this->body(['code' => 'AUDIT1', 'value' => 10]));

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/promocodes/{$promo->code}", $this->body(['code' => 'AUDIT1', 'value' => 15]))
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'admin.promocodes.update',
            'auditable_id' => $promo->id,
        ]);
    }

    public function test_раздел_акции_не_перезаписывается(): void
    {
        $admin = $this->owner();
        $promo = Promocode::query()->create($this->body(['code' => 'SUBS', 'scope' => 'subscription']));

        $тело = $this->body(['code' => 'SUBS', 'value' => 40]);
        unset($тело['scope']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/admin/promocodes/SUBS", $тело)
            ->assertOk();

        $promo->refresh();

        $this->assertSame(40, (int) $promo->value, 'процент не изменился');
        $this->assertSame(
            'subscription',
            $promo->scope,
            'правка процента перевела акцию в другой раздел — она перестала бы действовать там, где действовала',
        );
    }

    public function test_смена_кода_сохраняет_применения(): void
    {
        $admin = $this->owner();
        $покупатель = User::factory()->create();
        $promo = Promocode::query()->create($this->body(['code' => 'OPECHATKA']));
        $promo->usages()->create(['user_id' => $покупатель->id, 'used_at' => now()]);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/promocodes/OPECHATKA', $this->body(['code' => 'ISPRAVLENO']))
            ->assertOk();

        $promo->refresh();

        $this->assertSame('ISPRAVLENO', $promo->code);
        $this->assertSame(1, $promo->usages()->count(), 'применения отвязались от акции');
    }

    public function test_круг_людей_при_правке_без_изменений_остаётся_как_был(): void
    {
        $admin = $this->owner();
        $первый = User::factory()->create();
        $второй = User::factory()->create();
        $promo = Promocode::query()->create($this->body(['code' => 'KRUG']));
        $promo->audienceUsers()->attach([$первый->id, $второй->id], ['created_at' => now()->subDays(7)]);

        /*
         * Дата читается из таблицы связи, а не через `pivot`: в
         * `audienceUsers()` нет `withPivot('created_at')`, и первая
         * версия этой проверки сравнивала пустую строку с пустой —
         * то есть проходила при сломанной записи круга.
         */
        $дата = fn (): ?string => DB::table('promocode_users')
            ->where('promocode_id', $promo->id)
            ->where('user_id', $первый->id)
            ->value('created_at');
        $былаДата = $дата();
        $this->assertNotNull($былаДата, 'подготовка: дата включения в круг не записана');

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/promocodes/KRUG', $this->body([
                'code' => 'KRUG',
                'value' => 33,
                'audience' => 'selected',
                'user_ids' => [$первый->id, $второй->id],
            ]))
            ->assertOk();

        $promo->refresh();
        $круг = $promo->audienceUsers()->orderBy('users.id')->get();

        $this->assertSame([$первый->id, $второй->id], $круг->pluck('id')->all(), 'круг изменился');
        /*
         * Дата включения в круг — не «когда последний раз сохранили».
         * `sync` с атрибутами переписывал её всем, кто в круге уже был.
         */
        $this->assertSame(
            $былаДата,
            $дата(),
            'дата включения в круг переписана сохранением, которое ничего не меняло',
        );
    }

    public function test_переключение_на_всех_снимает_круг_целиком(): void
    {
        $admin = $this->owner();
        $кто = User::factory()->create();
        $promo = Promocode::query()->create($this->body(['code' => 'SNYAT']));
        $promo->audienceUsers()->attach([$кто->id], ['created_at' => now()]);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/promocodes/SNYAT', $this->body([
                'code' => 'SNYAT',
                'audience' => 'all',
                'user_ids' => [],
            ]))
            ->assertOk();

        $this->assertSame(0, $promo->fresh()->audienceUsers()->count(), 'круг остался невидимым запретом');
        $this->assertNull($promo->fresh()->user_id, 'старая привязка к одному человеку осталась');
    }

    public function test_непереданные_поля_остаются_прежними(): void
    {
        $admin = $this->owner();
        $promo = Promocode::query()->create($this->body([
            'code' => 'SOHRANI',
            'scope' => 'boost',
            'max_usages_per_user' => 3,
        ]));

        $тело = $this->body(['code' => 'SOHRANI', 'value' => 11]);
        unset($тело['scope']);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/promocodes/SOHRANI', $тело)
            ->assertOk();

        $promo->refresh();

        $this->assertSame('boost', $promo->scope, 'раздел перезаписан');
        $this->assertSame(3, (int) $promo->max_usages_per_user, 'предел на человека перезаписан');
    }
}
