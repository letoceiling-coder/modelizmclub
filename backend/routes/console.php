<?php

use Illuminate\Support\Facades\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Расписание
|--------------------------------------------------------------------------
|
| До 07.09 на проде не было запускателя: ни cron, ни таймера, ни записи в
| supervisor — единственный schedule:work на хосте обслуживал соседнее
| приложение. Всё перечисленное ниже существовало только в коде. Юниты
| теперь лежат в deploy/systemd, установка описана в deploy/README.md.
|
| withoutOverlapping везде, где задача ходит наружу или разгребает очередь:
| тик приходит раз в минуту, и медленный внешний ответ не должен собирать
| очередь из копий той же команды.
|
*/

Schedule::command('posts:publish-scheduled')->everyMinute()->withoutOverlapping();
Schedule::command('videos:publish-scheduled')->everyMinute()->withoutOverlapping();

// Раз в четверть часа, а не раз в час. Команда делает три вещи, и одна из
// них — гасить брошенные чекауты; их TTL 30 минут, так что при часовом
// запуске объявление оставалось в резерве до полутора часов после того,
// как покупатель закрыл вкладку.
//
// runInBackground — с тех пор, как команда взялась ещё и опрашивать холды.
// Опрос выдерживает паузу между запросами к банку, и полсотни холдов держат
// процесс около минуты. Без отдельного процесса на это время встают
// поминутные задачи расписания: они ждут, пока тик закончится.
Schedule::command('safe-deals:auto-release')->everyFifteenMinutes()->withoutOverlapping()->runInBackground();

// Опрос СДЭК и Яндекса по активным отправлениям. В расписании не было
// вовсе, и вызвать её больше неоткуда: без этого статус доставки, однажды
// записанный при создании, не менялся бы никогда.
Schedule::command('delivery:sync-statuses')->everyFifteenMinutes()->withoutOverlapping();

/*
 * Автоопрос банка по висящим платежам.
 *
 * Уведомление банка доходит не всегда, и до 08.09 спросить банк было некому:
 * платёж оставался в `pending` навсегда, а человек — без того, что купил.
 * 11.08 пользователь 606 заплатил трижды за четыре минуты, каждый раз доводя
 * оплату до конца на странице банка, и не получил ничего; нашли эти деньги
 * через месяц разбором.
 *
 * Опрашивает та же команда, что и разбор руками, — с окном и списком
 * исходов из `billing.auto_poll`. Ключи там же и объяснены; менять их можно
 * окружением, не трогая расписание.
 */
if (config('billing.auto_poll.enabled', true)) {
    Schedule::command('payments:reconcile-pending', [
        '--apply',
        '--provider=vtb',
        '--older-than='.(int) config('billing.auto_poll.older_than_minutes', 10),
        '--newer-than='.(int) config('billing.auto_poll.newer_than_minutes', 1440),
        '--limit='.(int) config('billing.auto_poll.limit', 50),
        '--only='.(string) config('billing.auto_poll.apply', 'paid,cancelled'),
    ])
        ->cron((string) config('billing.auto_poll.cron', '*/5 * * * *'))
        ->withoutOverlapping()
        // Опрос выдерживает паузу между запросами: полсотни платежей — около
        // минуты. Держать на это время весь тик расписания незачем.
        ->runInBackground();
}

Schedule::command('subscription:check-expired')->dailyAt('00:05');
Schedule::command('communities:sync-counters')->dailyAt('03:30');
Schedule::command('notifications:prune')->dailyAt('03:50');
