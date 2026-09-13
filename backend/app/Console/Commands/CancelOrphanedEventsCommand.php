<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Community\Services\ClubEventService;

/**
 * Ночная отмена мероприятий удалённых сообществ.
 *
 * Сообщество удаляется мягко, и каскад в базе не срабатывает: без этой задачи
 * события жили бы дальше, а отметившиеся не узнали бы, что идти некуда.
 * Ночью, а не в момент удаления — по решению заказчика 14.09.
 */
class CancelOrphanedEventsCommand extends Command
{
    protected $signature = 'events:cancel-orphaned';

    protected $description = 'Cancel events of deleted communities and notify attendees';

    public function handle(ClubEventService $events): int
    {
        $this->info('Отменено мероприятий удалённых сообществ: '.$events->cancelForDeletedCommunities());

        return self::SUCCESS;
    }
}
