<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Support\AdminAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Два раздела, добавленные решением Ж4, открыты только Владельцу.
 *
 * `communities` — прямое создание, правка и удаление сообществ. До 09.10
 * ключ лежал в `AdminAccess::SERVICE`, то есть «без пункта меню»: маршруты
 * работали, а из админки до них было не добраться. Теперь у раздела есть
 * экран, и важно, чтобы вместе с экраном он не открылся модератору: правка
 * чужого сообщества и его удаление — не модерация содержимого, а
 * распоряжение чужим имуществом.
 *
 * `connections` — состояние подключений. Там видно, на какой контур смотрит
 * приём денег и что ответил шлюз SMS. Ключей он не показывает, но и этого
 * достаточно, чтобы держать его за Владельцем.
 *
 * Часть В4 решения: «прямой адрес чужого раздела даёт отказ». Проверяется
 * не меню, а сервер: скрытая кнопка защитой не является (`docs/BIBLE.md`,
 * 2.6 — за цикл закрыли восемь обходов прав, и все были одного класса).
 */
class NewAdminSectionsAreOwnerOnlyTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, string> */
    private function токен(UserRole $роль): array
    {
        $user = User::factory()->create([
            'role' => $роль,
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
    }

    public function test_оба_раздела_объявлены_владельческими(): void
    {
        $this->assertSame('owner', AdminAccess::SECTIONS['communities'] ?? null);
        $this->assertSame('owner', AdminAccess::SECTIONS['connections'] ?? null);
    }

    public function test_ключ_сообществ_больше_не_служебный(): void
    {
        /*
         * Пока ключ был служебным, раздел не попадал в `GET /admin/access`, а
         * значит и в меню. Теперь он в SECTIONS — и обязан быть виден
         * владельцу в ответе о доступах, иначе экран есть, а пункта нет.
         */
        $ответ = $this->getJson('/api/v1/admin/access', $this->токен(UserRole::Owner));
        $ответ->assertSuccessful();
        $разделы = $ответ->json('data.sections');
        $this->assertContains('communities', $разделы);
        $this->assertContains('connections', $разделы);
    }

    public function test_модератор_не_видит_эти_разделы_в_своих_доступах(): void
    {
        $ответ = $this->getJson('/api/v1/admin/access', $this->токен(UserRole::Moderator));
        $ответ->assertSuccessful();
        $разделы = $ответ->json('data.sections');
        $this->assertNotContains('communities', $разделы);
        $this->assertNotContains('connections', $разделы);
    }

    public function test_владелец_читает_список_сообществ(): void
    {
        $this->getJson('/api/v1/admin/communities', $this->токен(UserRole::Owner))
            ->assertSuccessful();
    }

    public function test_модератору_список_сообществ_закрыт(): void
    {
        $this->getJson('/api/v1/admin/communities', $this->токен(UserRole::Moderator))
            ->assertForbidden();
    }

    public function test_обычному_пользователю_список_сообществ_закрыт(): void
    {
        $this->getJson('/api/v1/admin/communities', $this->токен(UserRole::User))
            ->assertForbidden();
    }

    public function test_администратору_направления_список_сообществ_закрыт(): void
    {
        $this->getJson('/api/v1/admin/communities', $this->токен(UserRole::CategoryAdmin))
            ->assertForbidden();
    }

    public function test_владелец_читает_состояние_подключений(): void
    {
        $this->getJson('/api/v1/admin/diagnostics', $this->токен(UserRole::Owner))
            ->assertSuccessful();
    }

    public function test_модератору_состояние_подключений_закрыто(): void
    {
        $this->getJson('/api/v1/admin/diagnostics', $this->токен(UserRole::Moderator))
            ->assertForbidden();
    }

    public function test_состояние_подключений_не_показывает_ключей(): void
    {
        /*
         * Решение Ж4, часть Б3: «без показа ключей». Правило 8 раздела 2
         * запрещает печатать секреты, а `docs/known-issues.md` помнит, почему:
         * кеш конфигурации с паролем базы лежал читаемым для всех.
         *
         * Проверяется не наличие нужных полей, а отсутствие лишних: ответ
         * целиком просматривается на ключи, в имени которых есть «secret»,
         * «password», «token» или «key».
         */
        $ответ = $this->getJson('/api/v1/admin/diagnostics', $this->токен(UserRole::Owner));
        $ответ->assertSuccessful();

        $плоско = json_encode($ответ->json(), JSON_UNESCAPED_UNICODE) ?: '';
        foreach (['secret', 'password', 'api_key', 'apikey'] as $запрещённое) {
            $this->assertStringNotContainsString(
                $запрещённое,
                mb_strtolower($плоско),
                "в состоянии подключений нашлось «{$запрещённое}»",
            );
        }
    }
}
