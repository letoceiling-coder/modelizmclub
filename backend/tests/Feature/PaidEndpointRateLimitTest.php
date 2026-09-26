<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Платные обращения к внешним API и открытый канал писем ограничены отдельно.
 *
 * Общий лимитер закрывает все API-маршруты (`throttleApi('api')`), но у гостя
 * это 120 в минуту с адреса. Для расчёта доставки это много: каждый вызов
 * уходит в СДЭК или Яндекс и стоит денег. Для обратной связи — это поток писем
 * с одного адреса.
 *
 * Аудит 26.09 записал эти маршруты как «без ограничителя» — неверно: замер
 * искал слово `throttle` у самого маршрута и не видел групповой. Лимит был,
 * просто слишком щедрый.
 */
class PaidEndpointRateLimitTest extends TestCase
{
    use RefreshDatabase;

    /** @return list<array{0: string, 1: string, 2: int}> */
    public static function ограниченные(): array
    {
        return [
            'расчёт СДЭК' => ['api/v1/delivery/cdek/quote', 'delivery-quote', 20],
            'расчёт Яндекса' => ['api/v1/delivery/yandex/quote', 'delivery-quote', 20],
            'обратная связь' => ['api/v1/feedback', 'feedback-send', 5],
        ];
    }

    #[DataProvider('ограниченные')]
    public function test_маршрут_проходит_через_свой_лимитер(string $uri, string $лимитер, int $потолок): void
    {
        $route = collect(Route::getRoutes()->getRoutes())
            ->first(fn ($r) => $r->uri() === $uri && in_array('POST', $r->methods(), true));

        $this->assertNotNull($route, "маршрут {$uri} не найден");

        $this->assertContains(
            "throttle:{$лимитер}",
            $route->gatherMiddleware(),
            "у {$uri} должен стоять свой ограничитель, иначе он живёт под общими 120 в минуту",
        );

        $ограничитель = RateLimiter::limiter($лимитер);
        $this->assertNotNull($ограничитель, "лимитер {$лимитер} не зарегистрирован");

        $limit = $ограничитель(Request::create("/{$uri}", 'POST'));
        $limit = is_array($limit) ? $limit[0] : $limit;

        $this->assertSame(
            $потолок,
            $limit->maxAttempts,
            "потолок у {$лимитер} должен быть заметно ниже общих 120",
        );
        $this->assertLessThan(
            120,
            $limit->maxAttempts,
            'иначе отдельный лимитер ничего не меняет по сравнению с общим',
        );
    }

    /**
     * Отказ называет причину и срок — иначе клиент не отличит его от поломки.
     */
    #[DataProvider('ограниченные')]
    public function test_отказ_объясняет_себя(string $uri, string $лимитер, int $потолок): void
    {
        $ограничитель = RateLimiter::limiter($лимитер);
        $limit = $ограничитель(Request::create("/{$uri}", 'POST'));
        $limit = is_array($limit) ? $limit[0] : $limit;

        $this->assertNotNull(
            $limit->responseCallback,
            "у {$лимитер} должен быть свой ответ: без него клиент получает пустое 429",
        );

        $ответ = call_user_func($limit->responseCallback, Request::create("/{$uri}", 'POST'), ['Retry-After' => 30]);

        $this->assertSame(429, $ответ->getStatusCode());
        $тело = $ответ->getData(true);
        $this->assertArrayHasKey('code', $тело);
        $this->assertArrayHasKey('retry_after', $тело);
        $this->assertSame(30, $тело['retry_after']);
    }

    /**
     * Ключ разделяет вошедших и адреса.
     *
     * Иначе несколько человек за одним адресом делят счётчик, и один
     * расчётливый покупатель отбирает расчёт доставки у остальных.
     */
    public function test_счётчик_у_вошедшего_свой(): void
    {
        $ограничитель = RateLimiter::limiter('delivery-quote');

        $гость = Request::create('/api/v1/delivery/cdek/quote', 'POST');
        $ключГостя = ($ограничитель($гость))->key ?? null;

        $this->assertNotNull($ключГостя);
        $this->assertStringContainsString('guest', $ключГостя);
    }
}
