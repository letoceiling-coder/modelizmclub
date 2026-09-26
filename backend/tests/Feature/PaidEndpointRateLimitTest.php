<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
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
            'расчёт при оформлении' => ['api/v1/listings/{uuid}/safe-deal/quote', 'delivery-quote', 20],
            'расчёт отправления' => ['api/v1/shipments/{shipment}/quote', 'delivery-quote', 20],
            'калькулятор СДЭК' => ['api/v1/delivery/cdek/quote', 'delivery-quote', 20],
            'калькулятор Яндекса' => ['api/v1/delivery/yandex/quote', 'delivery-quote', 20],
            'обратная связь' => ['api/v1/feedback', 'feedback-send', 10],
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

        /*
         * Сравнивать потолок с числом из того же набора данных бессмысленно —
         * это утверждение о себе. Проверяется то, что от лимитера нужно:
         * он заметно ниже общих 120, иначе не меняет ничего, и не настолько
         * низок, чтобы порезать обычную работу.
         */
        $this->assertLessThan(
            120,
            $limit->maxAttempts,
            'иначе отдельный лимитер ничего не меняет по сравнению с общим',
        );
        $this->assertGreaterThanOrEqual(
            10,
            $limit->maxAttempts,
            'ниже десяти начинает мешать обычной работе: расчёт при смене пункта, '
            .'повтор обращения после отказа валидации, несколько жалоб подряд',
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
    public function test_счётчик_у_вошедшего_отдельный_от_гостевого(): void
    {
        $ограничитель = RateLimiter::limiter('delivery-quote');

        $гость = Request::create('/api/v1/listings/x/safe-deal/quote', 'POST');
        $ключГостя = $ограничитель($гость)->key;

        $пользователь = User::factory()->create(['status' => UserStatus::Active]);
        $вошедший = Request::create('/api/v1/listings/x/safe-deal/quote', 'POST');
        $вошедший->setUserResolver(fn () => $пользователь);
        $ключВошедшего = $ограничитель($вошедший)->key;

        /*
         * Прежняя редакция этого теста строила только гостевой запрос и
         * проверяла, что в ключе есть слово «guest». Правку, выкинувшую
         * идентификатор пользователя из ключа целиком, она бы прошла.
         */
        $this->assertNotSame(
            $ключГостя,
            $ключВошедшего,
            'у вошедшего должен быть свой счётчик, иначе он делит его с гостями за тем же адресом',
        );
        $this->assertStringContainsString((string) $пользователь->id, $ключВошедшего);
    }

    /**
     * Отказ приходит на запросе сверх потолка — не «лимитер зарегистрирован»,
     * а он действительно отбивает.
     *
     * Считается каждый запрос, доехавший до маршрута: `ThrottleRequests` стоит
     * до контроллера, поэтому отказы валидации тратят попытки наравне с
     * удачными отправками. Ровно это и проверяется — тело заведомо пустое.
     */
    public function test_обратная_связь_отбивает_сверх_потолка(): void
    {
        $потолок = 10;

        for ($i = 1; $i <= $потолок; $i++) {
            $ответ = $this->postJson('/api/v1/feedback', []);
            $this->assertNotSame(
                429,
                $ответ->getStatusCode(),
                "запрос {$i} из {$потолок} не должен отбиваться",
            );
        }

        $этот = $this->postJson('/api/v1/feedback', []);

        $this->assertSame(429, $этот->getStatusCode(), 'запрос сверх потолка должен отбиваться');
        $этот->assertJsonPath('code', 'feedback_rate_limited');
        $this->assertGreaterThan(0, $этот->json('retry_after'));
    }
}
