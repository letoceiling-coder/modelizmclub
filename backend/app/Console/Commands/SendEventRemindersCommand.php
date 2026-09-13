<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Community\Services\ClubEventService;

/** Напоминание отметившимся за сутки до мероприятия. Раз в час, один раз на событие. */
class SendEventRemindersCommand extends Command
{
    protected $signature = 'events:send-reminders';

    protected $description = 'Remind attendees about events starting within 24 hours';

    public function handle(ClubEventService $events): int
    {
        $this->info('Напоминаний поставлено в очередь: '.$events->dispatchReminders());

        return self::SUCCESS;
    }
}
