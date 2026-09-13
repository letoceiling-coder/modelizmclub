<?php

namespace App\Policies;

use App\Enums\CommunityStatus;
use App\Models\ClubEvent;
use App\Models\Community;
use App\Models\User;

/**
 * Права на мероприятия — событие сообщества и событие площадки.
 *
 * Два вида различаются здесь, а не таблицами (см. ClubEvent):
 *
 * - событие сообщества создают и правят те, кто управляет сообществом
 *   (Community::canManage — владелец, модератор сообщества, модератор
 *   площадки), и администратор;
 * - событие площадки создаёт и правит только администратор.
 *
 * Видимость: событие площадки — всем; событие сообщества — тем, кто видит
 * сообщество. Открытое сообщество видят все, сообщество по заявке — только
 * участники. Черновик — только тем, кто может править.
 *
 * Ресурс отдаёт эти ответы блоком `can`, чтобы кнопки и запреты за ними
 * считал один и тот же код.
 */
class EventPolicy
{
    public function view(?User $user, ClubEvent $event): bool
    {
        if ($event->trashed()) {
            return $user !== null && $user->isAdmin();
        }
        if ($event->status === ClubEvent::STATUS_DRAFT) {
            return $user !== null && $this->canEdit($user, $event);
        }
        if ($event->isPlatform()) {
            return true;
        }

        $community = $event->community;
        if (! $community || $community->trashed() || $community->status !== CommunityStatus::Active) {
            return $user !== null && $user->isAdmin();
        }
        if ($community->isOpen()) {
            return true;
        }

        return $user !== null && ($this->isMember($user, $community) || $community->canManage($user) || $user->isAdmin());
    }

    /** Создать событие у сообщества; `null` — событие площадки. */
    public function create(User $user, ?Community $community = null): bool
    {
        if ($community === null) {
            return $user->isAdmin();
        }

        return $community->status === CommunityStatus::Active
            && ! $community->trashed()
            && ($community->canManage($user) || $user->isAdmin());
    }

    public function update(User $user, ClubEvent $event): bool
    {
        return ! $event->trashed() && $this->canEdit($user, $event);
    }

    public function delete(User $user, ClubEvent $event): bool
    {
        return ! $event->trashed() && $this->canEdit($user, $event);
    }

    /** Отметиться «пойду»: опубликовано, не отменено, ещё не началось, видно. */
    public function attend(User $user, ClubEvent $event): bool
    {
        return $event->status === ClubEvent::STATUS_PUBLISHED
            && ! $event->trashed()
            && ! $event->isPast()
            && $this->view($user, $event);
    }

    /** Видеть черновики, список участников целиком, править из админки. */
    public function manage(User $user, ClubEvent $event): bool
    {
        return $this->canEdit($user, $event);
    }

    private function canEdit(User $user, ClubEvent $event): bool
    {
        if ($user->isAdmin()) {
            return true;
        }
        if ($event->isPlatform()) {
            return false;
        }

        $community = $event->community;

        return $community !== null && ! $community->trashed() && $community->canManage($user);
    }

    private function isMember(User $user, Community $community): bool
    {
        return $community->members()->where('users.id', $user->id)->exists();
    }
}
