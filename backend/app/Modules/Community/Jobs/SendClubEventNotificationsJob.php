<?php

namespace Modules\Community\Jobs;

use App\Enums\UserStatus;
use App\Models\ClubEvent;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Рассылка о мероприятии — отдельной задачей, а не в запросе.
 *
 * Создание события не должно ждать, пока уведомления уйдут всем участникам
 * сообщества (до 34 сейчас) или всем пользователям для события площадки.
 * Через InAppNotify: тумблер «Мероприятия» в кабинете и настройки площадки
 * учитываются там же, где для остальных уведомлений.
 *
 *   published — участникам сообщества (кроме автора) или всем активным
 *               пользователям для события площадки;
 *   reminder  — отметившимся, за сутки до начала;
 *   cancelled — отметившимся.
 */
class SendClubEventNotificationsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public const PUBLISHED = 'published';

    public const REMINDER = 'reminder';

    public const CANCELLED = 'cancelled';

    public int $tries = 3;

    public function __construct(public readonly int $eventId, public readonly string $kind) {}

    public function handle(): void
    {
        $event = ClubEvent::withTrashed()->with('community')->find($this->eventId);
        if (! $event) {
            return;
        }

        $notification = $this->notificationFor($event);
        if ($notification === null) {
            return;
        }

        foreach ($this->recipients($event) as $query) {
            $query->chunkById(200, function ($users) use ($notification): void {
                foreach ($users as $user) {
                    InAppNotify::sendQuiet($user, $notification);
                }
            }, 'users.id', 'id');
        }
    }

    private function notificationFor(ClubEvent $event): ?InAppNotification
    {
        $link = '/events/'.$event->uuid;
        $when = $event->starts_at?->timezone(config('app.timezone'))->translatedFormat('j F, H:i') ?? '';
        $where = $event->isPlatform() ? 'МоДелизМ' : ($event->community?->name ?? '');

        return match ($this->kind) {
            self::PUBLISHED => $event->status === ClubEvent::STATUS_PUBLISHED && ! $event->isPast() && ! $event->trashed()
                ? new InAppNotification('event', 'Новое мероприятие: '.$event->title, trim($where.' · '.$when, ' ·'), $link)
                : null,
            self::REMINDER => $event->status === ClubEvent::STATUS_PUBLISHED && ! $event->trashed()
                ? new InAppNotification('event', 'Завтра: '.$event->title, trim($when.' · '.($event->location_name ?? ''), ' ·'), $link)
                : null,
            self::CANCELLED => new InAppNotification('event', 'Мероприятие отменено: '.$event->title, (string) ($event->cancel_reason ?? ''), $link),
            default => null,
        };
    }

    /** @return list<Builder|Relation> */
    private function recipients(ClubEvent $event): array
    {
        if ($this->kind !== self::PUBLISHED) {
            return [$event->attendees()->select('users.*')];
        }

        if ($event->isPlatform()) {
            return [User::query()->where('status', UserStatus::Active)];
        }

        $community = $event->community;
        if (! $community) {
            return [];
        }

        // Участник, выключивший уведомления сообщества, о событиях тоже не узнаёт.
        return [$community->members()
            ->select('users.*')
            ->where('users.id', '!=', (int) $event->created_by)
            ->where(fn ($q) => $q->where('community_members.notifications_enabled', true)
                ->orWhereNull('community_members.notifications_enabled'))];
    }
}
