<?php

namespace Tests\Feature;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
            'доставка' => ['/api/v1/safe-deals/webhooks/delivery'],
            'платежи (было исключено раньше)' => ['/api/v1/payments/webhooks/vtb'],
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

    public function test_ordinary_guest_path_is_still_throttled(): void
    {
        // Контроль: если исключение расширить неаккуратно, этот тест упадёт
        // первым и покажет, что под общий лимит перестал попадать весь API.
        $this->assertSame(120, $this->limitFor('/api/v1/feed')->maxAttempts);
    }
}
