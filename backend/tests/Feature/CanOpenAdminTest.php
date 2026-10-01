<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Support\AdminAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Кому сервер говорит, что в админку есть куда войти.
 *
 * До 01.10 пункт «Админ-панель» в меню аватара показывался по
 * `u.role === "owner"`, посчитанному в браузере. Модератор и
 * администратор направления входа не видели, хотя разделы им открыты,
 * и попадали в админку только по прямой ссылке.
 *
 * Условие — непустота списка разделов, а не роль: у кого разделов ноль,
 * тому ссылка привела бы в 403.
 */
class CanOpenAdminTest extends TestCase
{
    use RefreshDatabase;

    private function user(UserRole $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
    }

    public function test_четыре_состояния_роли(): void
    {
        $ожидание = [
            'owner' => true,
            'moderator' => true,
            'category_admin' => true,
            'user' => false,
        ];

        foreach ($ожидание as $роль => $ждём) {
            $кто = $this->user(UserRole::from($роль));

            $ответ = $this->actingAs($кто, 'sanctum')->getJson('/api/v1/auth/me');
            $ответ->assertOk();

            $this->assertSame(
                $ждём,
                $ответ->json('data.can_open_admin'),
                "роль «{$роль}»: ответ о доступе в админку",
            );

            // Поле обязано совпадать с картой, которая охраняет маршруты, —
            // иначе пункт меню и 403 разойдутся снова.
            $this->assertSame(
                AdminAccess::sectionsFor($кто) !== [],
                $ответ->json('data.can_open_admin'),
                "роль «{$роль}»: меню расходится с картой разделов",
            );
        }
    }

    public function test_разделы_у_каждой_роли_не_пустые_там_где_обещано(): void
    {
        foreach (['owner', 'moderator', 'category_admin'] as $роль) {
            $кто = $this->user(UserRole::from($роль));

            $this->assertNotSame(
                [],
                AdminAccess::sectionsFor($кто),
                "роль «{$роль}»: обещали вход, а разделов ноль — это тупик 403",
            );
        }
    }

    public function test_чужое_право_в_списке_пользователей_не_отдаётся(): void
    {
        $владелец = $this->user(UserRole::Owner);
        $this->user(UserRole::Moderator);

        $ответ = $this->actingAs($владелец, 'sanctum')->getJson('/api/v1/admin/users?per_page=50');
        $ответ->assertOk();

        $строки = $ответ->json('data.data') ?? $ответ->json('data') ?? [];
        // Пустая выборка выглядела бы как успех: «чужого нет» потому, что
        // нет никого. Убеждаемся, что в списке есть кто-то, кроме себя.
        $this->assertGreaterThan(1, count(is_array($строки) ? $строки : []), 'список пользователей пуст');
        $чужие = array_filter(
            is_array($строки) ? $строки : [],
            fn ($строка) => is_array($строка)
                && ($строка['id'] ?? null) !== $владелец->id
                && array_key_exists('can_open_admin', $строка),
        );

        $this->assertSame([], array_values($чужие), 'чужое право видно в списке пользователей');
    }
}
