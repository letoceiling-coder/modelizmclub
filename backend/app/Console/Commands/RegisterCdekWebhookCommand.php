<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Sleep;
use Modules\Delivery\Services\CdekApiExtension;
use Throwable;

/**
 * Подписать СДЭК на уведомления о статусах отправлений.
 *
 * Здесь до 22.09 стояло «СДЭК о нём не знал: подписки никто не создавал».
 * Это неверно: 22.09 в аккаунте нашлась подписка `ORDER_STATUS`
 * `155a4d79-bfbe-46d9-bb34-d9e85bf76377` на `https://modelizmclub.ru/...`,
 * то есть заведена она была, просто не на тот адрес — `APP_URL` сервиса
 * `https://api.modelizmclub.ru`. Утверждение писалось по памяти, а не по
 * запросу к API.
 *
 * Уведомлений действительно не приходило ни одного, но причина другая: на
 * 22.09 из девятнадцати отправлений СДЭК ни одно не заведено у перевозчика
 * (`external_id` пуст у всех девятнадцати, статусы `draft`, `error`,
 * `cancelled`). Слать было не о чем, и адрес подписки тут ни при чём.
 *
 * Статусы приезжают пятнадцатиминутным опросом (`delivery:sync-statuses`).
 * Опрос остаётся запасным путём: уведомление может не дойти, и тогда статус
 * подтянется следующим прогоном.
 *
 * Команда идемпотентна: лишние и устаревшие подписки того же типа снимаются,
 * нужная заводится заново. Запускать руками после смены домена или ключей —
 * подписка живёт на стороне СДЭК и выкаткой не обновляется.
 *
 * Итог команда проверяет перечитыванием списка, а не доверием к коду ответа:
 * СДЭК на `POST /webhooks` отвечает 200 и кладёт исход в
 * `requests[].state` — `SUCCESSFUL` либо `INVALID` с массивом `errors`.
 * Печатать «Готово» по одному лишь HTTP 200 значит сообщать об успехе,
 * которого могло не быть.
 */
class RegisterCdekWebhookCommand extends Command
{
    protected $signature = 'cdek:register-webhook
        {--url= : Адрес для уведомлений; по умолчанию APP_URL + /api/v1/webhooks/cdek/order-status}
        {--dry-run : Показать, что будет сделано, ничего не меняя}';

    protected $description = 'Подписать СДЭК на уведомления о статусах отправлений';

    /** Тип уведомления СДЭК: смена статуса заказа. */
    private const TYPE = 'ORDER_STATUS';

    /** Сколько раз перечитывать список, прежде чем признать неподтверждённым. */
    private const ПОПЫТОК = 3;

    /**
     * Пауза между перечитываниями. Короткая: длинную ждать в консоли незачем.
     * Через `Sleep`, а не `sleep()`, — иначе прогон тестов встанет на ней всерьёз.
     */
    private const ПАУЗА_СЕК = 3;

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
                if (($беда = $this->отказ($api->deleteWebhook($uuid))) !== null) {
                    $this->error('СДЭК не снял подписку '.$uuid.': '.$беда);

                    return self::FAILURE;
                }
            }
        }

        if ($уже === []) {
            $this->line('Завожу подписку на '.$url);
            if (! $dry) {
                if (($беда = $this->отказ($api->addWebhook(['type' => self::TYPE, 'url' => $url]))) !== null) {
                    $this->error('СДЭК не завёл подписку на '.$url.': '.$беда);

                    return self::FAILURE;
                }
            }
        }

        if ($dry) {
            $this->info('Сухой прогон: ничего не изменено.');

            return self::SUCCESS;
        }

        return $this->убедиться($api, $url);
    }

    /**
     * Перечитать список и убедиться, что вышло ровно то, чего добивались.
     *
     * Ответ на сам `POST` смотреть недостаточно: 22.09 команда отчиталась
     * «Готово», а подписка осталась прежней — тот же uuid, тот же чужой
     * адрес. Проверка со стороны данных отличает сделанное от отвеченного.
     */
    private function убедиться(CdekApiExtension $api, string $url): int
    {
        $адреса = [];

        for ($попытка = 1; $попытка <= self::ПОПЫТОК; $попытка++) {
            if ($попытка > 1) {
                Sleep::for(self::ПАУЗА_СЕК)->seconds();
            }

            try {
                $свои = array_values(array_filter(
                    $this->rows($api->listWebhooks()),
                    fn (array $row): bool => ($row['type'] ?? null) === self::TYPE,
                ));
            } catch (Throwable $e) {
                $this->error('Изменения внесены, но перечитать список не удалось: '.$e->getMessage());

                return self::FAILURE;
            }

            $адреса = array_map(static fn (array $row): string => (string) ($row['url'] ?? '?'), $свои);

            if ($адреса === [$url]) {
                $this->info('Готово: подписка одна, на '.$url);

                return self::SUCCESS;
            }
        }

        // Осторожно с формулировкой: это «не подтвердилось», а не «не вышло».
        // 22.09 на проде список отдавал прежнюю подписку и после успешного
        // прогона, а через некоторое время — уже новую. Сколько длится
        // расхождение, мы не знаем: замеров нет, известны только две точки.
        // Говорить здесь «СДЭК не завёл подписку» значит утверждать больше
        // известного и посылать человека чинить то, что могло уже работать.
        $this->warn(sprintf(
            'Изменения приняты, но список их пока не показывает: %d подписк(а/и) типа %s — %s',
            count($адреса),
            self::TYPE,
            $адреса === [] ? '(ни одной)' : implode(', ', $адреса),
        ));
        $this->warn('У СДЭК список обновляется не сразу. Перезапустите команду через несколько минут: если адрес станет нужным — всё вышло с первого раза.');

        return self::FAILURE;
    }

    /**
     * Исход операции СДЭК словами, либо null, если всё прошло.
     *
     * СДЭК отвечает 200 и на отказ тоже, складывая исход в `requests[]`:
     * `state` бывает `SUCCESSFUL`, `ACCEPTED`, `WAITING` — и `INVALID`
     * с массивом `errors`. Исключение из `decode()` ловит только коды 4xx
     * и 5xx, то есть мимо него отказ проходит незамеченным.
     *
     * @param  array<string, mixed>  $ответ
     */
    private function отказ(array $ответ): ?string
    {
        $requests = $ответ['requests'] ?? null;
        if (! is_array($requests)) {
            // Поле необязательное: на `DELETE` СДЭК возвращает пустое тело.
            // Отсутствие исхода — не отказ; настоящую проверку делает
            // `убедиться()` перечитыванием списка.
            return null;
        }

        foreach ($requests as $req) {
            if (! is_array($req)) {
                continue;
            }
            $state = (string) ($req['state'] ?? '');
            if ($state === '' || $state !== 'INVALID') {
                continue;
            }

            $errors = is_array($req['errors'] ?? null) ? $req['errors'] : [];
            $слова = array_map(
                static fn ($e): string => is_array($e)
                    ? trim(((string) ($e['code'] ?? '')).' '.((string) ($e['message'] ?? '')))
                    : (string) $e,
                $errors,
            );

            return $слова === [] ? 'state=INVALID без пояснений' : implode('; ', $слова);
        }

        return null;
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
