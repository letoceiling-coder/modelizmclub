<?php

namespace Tests\Feature;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Что общий лимит 120 запросов в минуту не должен трогать.
 *
 * Колбэки банка приходят с одного адреса, и для лимитера, считающего по IP,
 * это один очень активный гость. `payments/webhooks/*` из-за этого исключили
 * давно, а `safe-deals/webhooks/*` — забыли: замер 08.09 на тестовых ключах
 * дал 30 отказов 429 на 150 запросов залпом. Каждый отказ — потерянное
 * уведомление о движении денег, и узнать о нём неоткуда: банк не повторяет
 * бесконечно, а автоопроса на стороне площадки почти нет
 * (deploy/docs/vtb-go-live.md, §7).
 *
 * Проверяется сам лимитер, а не сто пятьдесят запросов подряд: правило живёт
 * в одном месте, и вопрос ровно один — попадает ли путь в список исключений.
 */
class ApiRateLimitExemptionTest extends TestCase
{
    private function limitFor(string $path): Limit
    {
        $limiter = RateLimiter::limiter('api');
        $this->assertNotNull($limiter, 'Лимитер api не зарегистрирован.');

        $request = Request::create($path, 'POST');
        $limit = $limiter($request);

        return is_array($limit) ? $limit[0] : $limit;
    }

    /** @return list<array{0: string}> */
    public static function exemptPaths(): array
    {
        return [
            'оплата сделки' => ['/api/v1/safe-deals/webhooks/vtb'],
            'выплата продавцу' => ['/api/v1/safe-deals/webhooks/vtb-payout'],
            'доставка сделки' => ['/api/v1/safe-deals/webhooks/delivery'],
            'платежи (было исключено раньше)' => ['/api/v1/payments/webhooks/vtb'],
            'СДЭК' => ['/api/v1/webhooks/cdek/order-status'],
            'Яндекс Доставка' => ['/api/v1/webhooks/yandex/delivery-status'],
            'MAX' => ['/api/v1/webhooks/max'],
        ];
    }

    #[DataProvider('exemptPaths')]
    public function test_webhook_paths_are_not_throttled(string $path): void
    {
        $this->assertSame(
            PHP_INT_MAX,
            $this->limitFor($path)->maxAttempts,
            "Путь {$path} считается общим лимитом — часть уведомлений банка получит 429.",
        );
    }

    /**
     * Список исключений перечислен руками, а вебхуки заводят по одному.
     *
     * `safe-deals/webhooks/*` именно так и отстал от соседнего
     * `payments/webhooks/*`: маршрут добавили, про лимитер не вспомнили, и
     * полтора месяца часть уведомлений банка получала 429. Перечисление
     * руками эту историю повторит — поэтому здесь проверяется не список, а
     * сами зарегистрированные маршруты: любой путь с сегментом `webhooks`
     * обязан быть исключён, когда бы его ни завели.
     */
    public function test_every_registered_webhook_route_is_exempt(): void
    {
        $webhooks = [];

        foreach (Route::getRoutes() as $route) {
            if (in_array('webhooks', explode('/', $route->uri()), true)) {
                $webhooks[$route->uri()] = true;
            }
        }

        $webhooks = array_keys($webhooks);

        // Проверка на пустоту: без неё цикл по нулю маршрутов проходил бы
        // молча и выглядел бы зелёным ровно тогда, когда сломан отбор.
        $this->assertGreaterThanOrEqual(7, count($webhooks), 'маршруты вебхуков не найдены — сломан отбор, а не лимитер');

        foreach ($webhooks as $uri) {
            $this->assertSame(
                PHP_INT_MAX,
                $this->limitFor('/'.$uri)->maxAttempts,
                "Маршрут {$uri} считается общим лимитом — часть уведомлений получит 429.",
            );
        }
    }

    public function test_ordinary_guest_path_is_still_throttled(): void
    {
        // Контроль: если исключение расширить неаккуратно, этот тест упадёт
        // первым и покажет, что под общий лимит перестал попадать весь API.
        $this->assertSame(120, $this->limitFor('/api/v1/feed')->maxAttempts);
    }

    public function test_oauth_return_is_throttled_on_purpose(): void
    {
        /*
         * Возврат из ВКонтакте и Яндекса выглядит как колбэк, но приходит из
         * браузера человека и с его адреса — то есть считать его по IP как
         * раз правильно. Отдельный случай здесь затем, чтобы отбор «всё, что
         * похоже на колбэк» однажды не расширили на него заодно.
         */
        $this->assertSame(120, $this->limitFor('/api/v1/auth/oauth/vk/callback')->maxAttempts);
    }
}
