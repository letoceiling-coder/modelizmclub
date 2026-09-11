<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * GHSA-5vg9-5847-vvmq: CRLF в адресе мимо стандартного правила email.
 *
 * Каждое поле, куда адрес приходит извне и откуда он может уйти в заголовок
 * письма, отбивает адреса с управляющими символами. Вставки взяты те, что
 * стандартное `email` и `email:rfc` в Laravel 11.54 пропускают — замер
 * 11.09. Простое «адрес\r\nBcc: …» Laravel отбивает и сам, поэтому здесь
 * его нет: тест должен падать без SafeEmail, а не проходить в любом случае.
 *
 * Лишних полей запросы не несут: регистрация, смена адреса и сброс не
 * доходят до создания учётки и отправки письма — ответ 422 по другим полям
 * нужен тесту так же, как по адресу.
 */
class EmailCrlfValidationTest extends TestCase
{
    use RefreshDatabase;

    private const MESSAGE = 'Адрес содержит недопустимые символы.';

    private const ENDPOINTS = [
        'register',
        'login',
        'forgot-password',
        'reset-password',
        'verify-email',
        'admin-store',
        'admin-update',
        'change-email',
    ];

    /** @return array<string, string> */
    private static function hostileAddresses(): array
    {
        return [
            'CRLF в кавычках' => "\"a\r\n b\"@example.com",
            'CRLF в комментарии' => "user(\r\n c)@example.com",
            'NUL' => "user\0@example.com",
            'LINE SEPARATOR' => "user\u{2028}@example.com",
        ];
    }

    /** @return iterable<string, array{string, string}> */
    public static function hostileCases(): iterable
    {
        foreach (self::ENDPOINTS as $endpoint) {
            foreach (self::hostileAddresses() as $name => $email) {
                yield "{$endpoint} / {$name}" => [$endpoint, $email];
            }
        }
    }

    #[DataProvider('hostileCases')]
    public function test_hostile_address_is_rejected(string $endpoint, string $email): void
    {
        $response = $this->send($endpoint, $email);

        $response->assertStatus(422);
        $this->assertContains(self::MESSAGE, $response->json('errors.'.$this->field($endpoint)) ?? []);
    }

    /** @return iterable<string, array{string}> */
    public static function endpoints(): iterable
    {
        foreach (self::ENDPOINTS as $endpoint) {
            yield $endpoint => [$endpoint];
        }
    }

    #[DataProvider('endpoints')]
    public function test_plain_address_is_not_rejected_by_the_rule(string $endpoint): void
    {
        $response = $this->send($endpoint, 'ivan.petrov+club@example.com');

        $this->assertNotContains(self::MESSAGE, $response->json('errors.'.$this->field($endpoint)) ?? []);
    }

    private function field(string $endpoint): string
    {
        return $endpoint === 'change-email' ? 'new_email' : 'email';
    }

    private function send(string $endpoint, string $email): TestResponse
    {
        return match ($endpoint) {
            'register' => $this->postJson('/api/v1/auth/register', ['email' => $email]),
            'login' => $this->postJson('/api/v1/auth/login', ['email' => $email]),
            'forgot-password' => $this->postJson('/api/v1/auth/forgot-password', ['email' => $email]),
            'reset-password' => $this->postJson('/api/v1/auth/reset-password', ['email' => $email]),
            'verify-email' => $this->postJson('/api/v1/auth/verify-email', ['email' => $email]),
            'admin-store' => $this->asAdmin()->postJson('/api/v1/admin/users', ['email' => $email]),
            'admin-update' => $this->updateAsAdmin($email),
            'change-email' => $this->asMember()->postJson('/api/v1/account/change-email', ['new_email' => $email]),
        };
    }

    private function asAdmin(): static
    {
        $this->seed(RoleSeeder::class);
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Admin]));

        return $this;
    }

    private function updateAsAdmin(string $email): TestResponse
    {
        $target = User::factory()->create();

        return $this->asAdmin()->patchJson("/api/v1/admin/users/{$target->uuid}", ['email' => $email]);
    }

    private function asMember(): static
    {
        Sanctum::actingAs(User::factory()->create());

        return $this;
    }
}
