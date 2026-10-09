<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Подтверждённый телефон требуется ровно там, где решил владелец. Решение З2.
 *
 * До 09.10 посредник `verified` требовал и почту, и телефон, и стоял на 134
 * маршрутах — включая пометку уведомления прочитанным, чтение закладок и чат
 * сообщества. Отсюда росли три жалобы владельца из четырёх: сообщество не
 * открыть, мессенджер не открыть, окно подтверждения поверх страниц.
 *
 * Эта проверка — не о поведении, а о списке. Правило, за которым никто не
 * следит, через месяц перестаёт быть правилом: следующий маршрут напишут с
 * прежним посредником, и требование вернётся само собой, молча и по одному
 * маршруту за раз. Поэтому список закрыт здесь, и расширить его можно только
 * назвав новый маршрут вслух — вместе с решением владельца, которое это
 * разрешает.
 */
class PhoneRequiredOnlyWhereDecidedTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Решение З2: публикация объявления и вывод средств. И больше ничего.
     *
     * @var list<string>
     */
    private const ALLOWED = [
        'POST api/v1/listings',
        'POST api/v1/listings/{uuid}/publish',
        'POST api/v1/wallet/withdraw',
        'PUT api/v1/account/payout-requisites',
    ];

    /** @return list<string> */
    private function routesBehindPhoneGate(): array
    {
        $found = [];

        foreach (Route::getRoutes() as $route) {
            $middleware = $route->gatherMiddleware();
            $hasGate = false;
            foreach ($middleware as $m) {
                if (! is_string($m)) {
                    continue;
                }
                if ($m === 'verified.phone' || str_contains($m, 'EnsurePhoneVerified')) {
                    $hasGate = true;
                    break;
                }
            }
            if (! $hasGate) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    continue;
                }
                $found[] = $method.' '.$route->uri();
            }
        }

        $found = array_values(array_unique($found));
        sort($found);

        return $found;
    }

    public function test_phone_is_required_exactly_where_the_owner_decided(): void
    {
        $expected = self::ALLOWED;
        sort($expected);

        $this->assertSame(
            $expected,
            $this->routesBehindPhoneGate(),
            "Список маршрутов с требованием подтверждённого телефона изменился.\n".
            "По решению З2 телефон нужен только для публикации объявления и вывода средств.\n".
            'Добавили маршрут — назовите его в ALLOWED и объясните, какое решение владельца это разрешает.',
        );
    }

    /** Старого имени больше нет: иначе требование телефона вернётся через него. */
    public function test_the_old_combined_alias_is_gone(): void
    {
        $withOldAlias = [];

        foreach (Route::getRoutes() as $route) {
            foreach ($route->gatherMiddleware() as $m) {
                if (is_string($m) && (str_contains($m, 'EnsureFullyVerified') || $m === 'verified')) {
                    $withOldAlias[] = $route->uri();
                }
            }
        }

        $this->assertSame(
            [],
            array_values(array_unique($withOldAlias)),
            'Посредник `verified` / EnsureFullyVerified требовал и почту, и телефон сразу. '.
            'Используйте `verified.email` или `verified.phone` — что именно нужно этому маршруту.',
        );
    }

    /**
     * Человек без телефона читает и пишет — и упирается только там, где решено.
     *
     * Это уже про поведение, а не про список: сервер отвечает на запросы из
     * пункта 3 части Б промпта 02.
     */
    public function test_a_person_without_a_phone_can_use_the_service(): void
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
        ]);
        $headers = ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];

        // Читает: лента, сообщества, каналы, свои беседы, объявления.
        foreach ([
            '/api/v1/feed',
            '/api/v1/communities',
            '/api/v1/channels',
            '/api/v1/conversations',
            '/api/v1/listings',
        ] as $url) {
            $response = $this->getJson($url, $headers);
            $this->assertNotSame(
                403,
                $response->status(),
                $url.' закрыт человеку без подтверждённого телефона: '.$response->getContent(),
            );
        }

        // Упирается в телефон ровно на двух действиях.
        $this->postJson('/api/v1/wallet/withdraw', ['amount' => 100], $headers)
            ->assertStatus(403)
            ->assertJsonPath('code', 'phone_not_verified');
    }
}
