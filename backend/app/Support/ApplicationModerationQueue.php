<?php

namespace App\Support;

use App\Models\ChannelApplication;
use App\Models\CommunityApplication;
use App\Models\ModerationQueue;

/**
 * Заявки на сообщество и канал — в общей очереди модерации.
 *
 * До 17.09 заявка жила только в своей таблице и в разделе «Заявки», а
 * модератор работает в «Модерации». Приёмка: «заявка на создание сообщества
 * не видна модератору в общей очереди». На проде 17.09 все 32 рассмотренные
 * заявки (18 на сообщество, 14 на канал) рассмотрели Владельцы, ни одной —
 * модератор; заявка 9 «Автоклуб» ждала решения 10 дней, заявка 8 — почти 5.
 *
 * Очередь — рабочий список, статус решает сама заявка. Строка в очереди
 * заводится, когда заявка появляется, и закрывается, когда у заявки меняется
 * статус — событиями модели, а не в каждом месте, где заявку решают: решают
 * её из двух разделов, и ReconcileModerationQueueCommand описывает, чем
 * кончилось, когда у объявлений путь к статусу был второй и очередь о нём не
 * знала.
 *
 * `sync()` подбирает то, что мимо событий: заявки, поданные до выкатки, и
 * записи, изменённые прямым SQL.
 */
final class ApplicationModerationQueue
{
    /** @var array<class-string, string> модель → имя очереди и тип в адресе решения */
    public const QUEUES = [
        CommunityApplication::class => 'community_applications',
        ChannelApplication::class => 'channel_applications',
    ];

    public static function enqueue(CommunityApplication|ChannelApplication $application): void
    {
        if ($application->status->value !== 'pending') {
            return;
        }

        ModerationQueue::query()->updateOrCreate(
            [
                'moderatable_type' => $application::class,
                'moderatable_id' => $application->getKey(),
            ],
            [
                'queue' => self::QUEUES[$application::class],
                'priority' => 0,
                'status' => 'pending',
            ],
        );
    }

    /** Заявка решена — строка очереди принимает её статус. */
    public static function close(CommunityApplication|ChannelApplication $application): void
    {
        $status = $application->status->value;
        if ($status === 'pending') {
            return;
        }

        ModerationQueue::query()
            ->where('moderatable_type', $application::class)
            ->where('moderatable_id', $application->getKey())
            ->whereIn('status', ['pending', 'revision'])
            ->update(['status' => $status]);
    }

    /** Свести очередь с заявками: завести недостающие строки и закрыть решённые. */
    public static function sync(): void
    {
        foreach (array_keys(self::QUEUES) as $class) {
            $class::query()
                ->where('status', 'pending')
                ->whereNotExists(function ($q) use ($class): void {
                    $q->selectRaw('1')
                        ->from('moderation_queue')
                        ->where('moderation_queue.moderatable_type', $class)
                        ->whereColumn('moderation_queue.moderatable_id', (new $class)->getTable().'.id');
                })
                ->each(fn ($application) => self::enqueue($application));

            $table = (new $class)->getTable();
            ModerationQueue::query()
                ->where('moderatable_type', $class)
                ->where('status', 'pending')
                ->whereExists(function ($q) use ($table): void {
                    $q->selectRaw('1')
                        ->from($table)
                        ->whereColumn($table.'.id', 'moderation_queue.moderatable_id')
                        ->where($table.'.status', '!=', 'pending');
                })
                ->each(function (ModerationQueue $row) use ($class): void {
                    $application = $class::query()->find($row->moderatable_id);
                    if ($application !== null) {
                        self::close($application);
                    }
                });
        }
    }
}
