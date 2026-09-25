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
 * - событие сообщества создают и правят владелец и модераторы сообщества
 *   (Community::canManage). Модерация площадки его только отменяет или
 *   снимает: до 17.09 модератор и администратор площадки создавали и
 *   правили события в чужих сообществах;
 * - событие площадки создаёт, правит, отменяет и снимает администратор.
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
            return $user !== null && $user->isOwner();
        }
        if ($event->status === ClubEvent::STATUS_DRAFT) {
            return $user !== null && ($this->canEdit($user, $event) || $this->canTakeDown($user, $event));
        }
        if ($event->isPlatform()) {
            return true;
        }

        $community = $event->community;
        if (! $community || $community->trashed() || $community->status !== CommunityStatus::Active) {
            return $user !== null && $user->isOwner();
        }
        if ($community->isOpen()) {
            return true;
        }

        return $user !== null && ($this->isMember($user, $community) || $community->canModerate($user));
    }

    /** Создать событие у сообщества; `null` — событие площадки. */
    public function create(User $user, ?Community $community = null): bool
    {
        if ($community === null) {
            return $user->isOwner();
        }

        return $community->status === CommunityStatus::Active
            && ! $community->trashed()
            && $community->canManage($user);
    }

    public function update(User $user, ClubEvent $event): bool
    {
        return ! $event->trashed() && $this->canEdit($user, $event);
    }

    /** Снять: команда сообщества или модерация площадки. */
    public function delete(User $user, ClubEvent $event): bool
    {
        return ! $event->trashed() && ($this->canEdit($user, $event) || $this->canTakeDown($user, $event));
    }

    /** Отменить: команда сообщества или модерация площадки. */
    public function cancel(User $user, ClubEvent $event): bool
    {
        return ! $event->trashed()
            && $event->status !== ClubEvent::STATUS_CANCELLED
            && ($this->canEdit($user, $event) || $this->canTakeDown($user, $event));
    }

    /** Отметиться «пойду»: опубликовано, не отменено, ещё не началось, видно. */
    public function attend(User $user, ClubEvent $event): bool
    {
        return $event->status === ClubEvent::STATUS_PUBLISHED
            && ! $event->trashed()
            && ! $event->isPast()
            && $this->view($user, $event);
    }

    /**
     * Напомнить отметившимся по кнопке.
     *
     * Права те же, что у отмены, — это действие организатора, а не
     * модерации площадки: напоминание приходит от имени мероприятия, и
     * решать, когда тревожить людей, должен тот, кто его ведёт.
     */
    public function remind(User $user, ClubEvent $event): bool
    {
        /*
         * Здесь решается только «кто», но не «когда». Проверяй политика
         * ещё и состояние — организатор, нажавший кнопку через минуту
         * после начала, получил бы «напомнить может организатор», то есть
         * ответ про права вместо ответа про время. «Прошло» и «не
         * опубликовано» отвечает сервис, словами.
         */
        return ! $event->trashed() && $this->canEdit($user, $event);
    }

    /** Видеть черновики, список участников целиком, править из админки. */
    public function manage(User $user, ClubEvent $event): bool
    {
        return $this->canEdit($user, $event) || $this->canTakeDown($user, $event);
    }

    private function canEdit(User $user, ClubEvent $event): bool
    {
        if ($event->isPlatform()) {
            return $user->isOwner();
        }
        $community = $event->community;

        return $community !== null && ! $community->trashed() && $community->canManage($user);
    }

    /** Модерация площадки: отменить и снять чужое событие, но не править его. */
    private function canTakeDown(User $user, ClubEvent $event): bool
    {
        return $event->isPlatform() ? $user->isOwner() : $user->isModerator();
    }

    private function isMember(User $user, Community $community): bool
    {
        return $community->members()->where('users.id', $user->id)->exists();
    }
}
