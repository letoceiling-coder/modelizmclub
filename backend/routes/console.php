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
Schedule::command('safe-deals:auto-release')->everyFifteenMinutes()->withoutOverlapping();

// Опрос СДЭК и Яндекса по активным отправлениям. В расписании не было
// вовсе, и вызвать её больше неоткуда: без этого статус доставки, однажды
// записанный при создании, не менялся бы никогда.
Schedule::command('delivery:sync-statuses')->everyFifteenMinutes()->withoutOverlapping();

Schedule::command('subscription:check-expired')->dailyAt('00:05');
Schedule::command('communities:sync-counters')->dailyAt('03:30');
Schedule::command('notifications:prune')->dailyAt('03:50');
