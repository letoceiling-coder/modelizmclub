<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Promocode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        $promo->usages()->create(['user_id' => $покупатель->id, 'discount_kopecks' => 5000]);

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
}
