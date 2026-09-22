<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Delivery\Services\CdekApiExtension;
use Throwable;

/**
 * Подписать СДЭК на уведомления о статусах отправлений.
 *
 * Адрес `POST /api/v1/webhooks/cdek/order-status` существовал с 25.08, но
 * СДЭК о нём не знал: подписки никто не создавал. Статусы приезжали
 * пятнадцатиминутным опросом (`delivery:sync-statuses`), то есть покупатель
 * узнавал об отгрузке в среднем через семь минут после неё, а продавец о
 * вручении — так же. Опрос остаётся запасным путём: уведомление может не
 * дойти, и тогда статус подтянется следующим прогоном.
 *
 * Команда идемпотентна: лишние и устаревшие подписки того же типа снимаются,
 * нужная заводится заново. Запускать руками после смены домена или ключей —
 * подписка живёт на стороне СДЭК и выкаткой не обновляется.
 */
class RegisterCdekWebhookCommand extends Command
{
    protected $signature = 'cdek:register-webhook
        {--url= : Адрес для уведомлений; по умолчанию APP_URL + /api/v1/webhooks/cdek/order-status}
        {--dry-run : Показать, что будет сделано, ничего не меняя}';

    protected $description = 'Подписать СДЭК на уведомления о статусах отправлений';

    /** Тип уведомления СДЭК: смена статуса заказа. */
    private const TYPE = 'ORDER_STATUS';

    public function handle(CdekApiExtension $api): int
    {
        $url = (string) ($this->option('url') ?: rtrim((string) config('app.url'), '/').'/api/v1/webhooks/cdek/order-status');
        $dry = (bool) $this->option('dry-run');

        if (! str_starts_with($url, 'https://')) {
            // СДЭК не стучится на http: подписка примется, а уведомления не
            // придут — и это выглядит как «вебхуки не работают».
            $this->error('Адрес уведомлений должен быть https: '.$url);

            return self::FAILURE;
        }

        try {
            $existing = $this->rows($api->listWebhooks());
        } catch (Throwable $e) {
            $this->error('Не удалось получить список подписок: '.$e->getMessage());

            return self::FAILURE;
        }

        $свои = array_values(array_filter(
            $existing,
            fn (array $row): bool => ($row['type'] ?? null) === self::TYPE,
        ));

        $уже = array_values(array_filter($свои, fn (array $row): bool => ($row['url'] ?? null) === $url));
        $лишние = array_values(array_filter($свои, fn (array $row): bool => ($row['url'] ?? null) !== $url));

        $this->line(sprintf('Подписок типа %s: %d, на нужный адрес: %d', self::TYPE, count($свои), count($уже)));

        if ($уже !== [] && $лишние === []) {
            $this->info('Всё на месте — подписка уже заведена на '.$url);

            return self::SUCCESS;
        }

        foreach ($лишние as $row) {
            $uuid = (string) ($row['uuid'] ?? '');
            $this->line('Снимаю устаревшую подписку '.$uuid.' → '.($row['url'] ?? '?'));
            if (! $dry && $uuid !== '') {
                $api->deleteWebhook($uuid);
            }
        }

        if ($уже === []) {
            $this->line('Завожу подписку на '.$url);
            if (! $dry) {
                $api->addWebhook(['type' => self::TYPE, 'url' => $url]);
            }
        }

        $this->info($dry ? 'Сухой прогон: ничего не изменено.' : 'Готово.');

        return self::SUCCESS;
    }

    /**
     * Ответ СДЭК бывает и списком, и обёрткой `{entity: […]}`.
     *
     * @param  array<string, mixed>  $result
     * @return array<int, array<string, mixed>>
     */
    private function rows(array $result): array
    {
        $rows = $result['entity'] ?? $result;

        return array_values(array_filter(
            is_array($rows) ? $rows : [],
            static fn ($row): bool => is_array($row),
        ));
    }
}
