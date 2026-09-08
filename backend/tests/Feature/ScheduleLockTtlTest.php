<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

/**
 * Срок замка не длиннее интервала запуска.
 *
 * `withoutOverlapping()` без аргумента даёт сутки. Замок снимает сам процесс в
 * конце работы — а если он умер, не снимает никто, и команда молчит до
 * истечения срока. 08.09 так и вышло: `safe-deals:auto-release` и
 * `payments:reconcile-pending` не запускались шесть часов, в Redis висели два
 * замка с семнадцатью часами остатка. Брошенный чекаут держал объявление два
 * с половиной часа вместо тридцати минут.
 *
 * Проверка идёт по разобранному расписанию, а не по тексту файла: важно
 * итоговое значение, а не то, как оно записано.
 */
class ScheduleLockTtlTest extends TestCase
{
    /** Интервал команды в минутах — по её cron-выражению. */
    private function intervalMinutes(Event $event): ?int
    {
        return match (true) {
            $event->expression === '* * * * *' => 1,
            (bool) preg_match('#^\*/(\d+) \* \* \* \*$#', $event->expression, $m) => (int) $m[1],
            default => null,
        };
    }

    public function test_lock_never_outlives_the_interval(): void
    {
        $events = app(Schedule::class)->events();

        $this->assertNotEmpty($events, 'расписание пусто — проверка выродилась');

        $checked = 0;

        foreach ($events as $event) {
            if (! $event->withoutOverlapping) {
                continue;
            }

            $interval = $this->intervalMinutes($event);

            if ($interval === null) {
                // Суточные и недельные задачи: у них умолчание и так не длиннее
                // интервала, сравнивать не с чем.
                continue;
            }

            $checked++;

            $this->assertLessThanOrEqual(
                $interval,
                $event->expiresAt,
                "Команда «{$event->command}» запускается раз в {$interval} мин, ".
                "а замок держится {$event->expiresAt} мин. Один сбой заблокирует её ".
                'до истечения срока.',
            );
        }

        // Без этого проверка прошла бы молча, если бы `withoutOverlapping`
        // однажды исчез из расписания вовсе.
        $this->assertGreaterThanOrEqual(5, $checked, 'проверено меньше команд, чем ожидалось');
    }
}
