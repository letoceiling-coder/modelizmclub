<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Вебхук MAX закрыт, когда секрет не настроен.
 *
 * До 03.10 условие было обратным — `if ($secret !== '')` снимало проверку
 * целиком. А это единственный вход, которому доверяют номер телефона: открытый
 * адрес давал вход в любую учётку по известному номеру. Пустой секрет
 * получается сам, без чьей-либо ошибки: `env()` отдаёт null, если `.env` не
 * читается, и ровно это случилось 07.09 после `config:clear` от www-data.
 */
class MaxWebhookSecretTest extends TestCase
{
    use RefreshDatabase;

    private const PAYLOAD = ['update_type' => 'bot_started', 'payload' => 'session', 'user' => ['user_id' => 1]];

    public function test_webhook_is_closed_when_secret_is_not_configured(): void
    {
        config(['services.max.webhook_secret' => '']);

        $this->postJson('/api/v1/webhooks/max', self::PAYLOAD)
            ->assertStatus(404);
    }

    public function test_webhook_is_closed_when_secret_is_null(): void
    {
        // Именно так выглядит нечитаемый `.env`: ключа нет вовсе.
        config(['services.max.webhook_secret' => null]);

        $this->postJson('/api/v1/webhooks/max', self::PAYLOAD)
            ->assertStatus(404);
    }

    public function test_webhook_rejects_a_wrong_secret(): void
    {
        config(['services.max.webhook_secret' => 'правильный']);

        $this->postJson('/api/v1/webhooks/max', self::PAYLOAD, ['X-Max-Bot-Api-Secret' => 'неправильный'])
            ->assertStatus(401);
    }

    public function test_webhook_rejects_a_missing_header_when_secret_is_set(): void
    {
        config(['services.max.webhook_secret' => 'правильный']);

        $this->postJson('/api/v1/webhooks/max', self::PAYLOAD)
            ->assertStatus(401);
    }

    public function test_webhook_accepts_the_configured_secret(): void
    {
        config(['services.max.webhook_secret' => 'правильный']);

        $this->postJson('/api/v1/webhooks/max', self::PAYLOAD, ['X-Max-Bot-Api-Secret' => 'правильный'])
            ->assertOk()
            ->assertJson(['ok' => true]);
    }
}
