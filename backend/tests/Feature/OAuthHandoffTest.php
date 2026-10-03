<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Auth\Services\OAuthHandoffService;
use Tests\TestCase;

/**
 * Токен не едет в адресной строке.
 *
 * До 03.10 вход через провайдера возвращал `/login?oauth_token=<токен>`, и
 * этого было достаточно, чтобы непросроченный bearer-токен попал в журнал
 * nginx (основной `location /` логируется целой строкой запроса) и, возможно,
 * в Яндекс.Метрику. Теперь в адресе разовый код, а токен приходит в теле
 * ответа на обмен.
 */
class OAuthHandoffTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_code_is_exchanged_for_the_token_once(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;
        $code = app(OAuthHandoffService::class)->issue($token);

        $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('data.token', $token);

        // Второй раз тот же код не работает: `Cache::pull` читает и удаляет
        // одной операцией.
        $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('code', 'oauth_code_invalid');
    }

    public function test_the_exchanged_token_actually_authenticates(): void
    {
        $user = User::factory()->create();
        $code = app(OAuthHandoffService::class)->issue($user->createToken('api')->plainTextToken);

        $token = $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $code])
            ->assertOk()
            ->json('data.token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_an_unknown_code_is_refused(): void
    {
        $this->postJson('/api/v1/auth/oauth/exchange', ['code' => str_repeat('a', 64)])
            ->assertStatus(422)
            ->assertJsonPath('code', 'oauth_code_invalid');
    }

    public function test_the_response_is_not_cacheable(): void
    {
        $user = User::factory()->create();
        $code = app(OAuthHandoffService::class)->issue($user->createToken('api')->plainTextToken);

        $ответ = $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $code])->assertOk();

        $this->assertStringContainsString('no-store', (string) $ответ->headers->get('Cache-Control'));
    }

    public function test_the_code_is_not_the_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;
        $code = app(OAuthHandoffService::class)->issue($token);

        // Если бы код совпадал с токеном, вся правка была бы
        // переименованием параметра.
        $this->assertNotSame($token, $code);
    }
}
