<?php

namespace App\Policies;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Models\Community;
use App\Models\User;

/**
 * Права на сообщество в одном месте.
 *
 * До этого правила были рассыпаны: владельца проверял `isOwnedBy` в модели,
 * управление — `canManage` там же, участие — запрос к сводной таблице в трёх
 * разных сервисах. Ресурс отдаёт эти же ответы блоком `can`, и считает их
 * теперь тот же код, что и охраняет маршруты, — иначе кнопка и запрет за ней
 * рано или поздно разойдутся.
 */
class CommunityPolicy
{
    /**
     * Вступить: в живое сообщество, где ты ещё не состоишь. Закрытое тоже
     * можно — там это заявка, и её разбирает CommunityHubService.
     */
    public function join(User $user, Community $community): bool
    {
        return $this->isActive($community) && ! $this->isMember($user, $community);
    }

    /**
     * Выйти: участник, но не владелец. Владельцу выход запрещён отдельным
     * сообщением в сервисе — сообщество без владельца остаётся без хозяина.
     */
    public function leave(User $user, Community $community): bool
    {
        return $this->isActive($community)
            && $this->isMember($user, $community)
            && ! $this->isOwner($user, $community);
    }

    /** Настройки, заявки, бан участника, удаление. */
    public function manage(User $user, Community $community): bool
    {
        return $this->canManage($user, $community);
    }

    /** Публиковать на стене: участник или тот, кто управляет. */
    public function post(User $user, Community $community): bool
    {
        return $this->isActive($community)
            && ($this->isMember($user, $community) || $this->canManage($user, $community));
    }

    /** Звать друзей может тот, кто сам внутри. */
    public function invite(User $user, Community $community): bool
    {
        return $this->isActive($community) && $this->isMember($user, $community);
    }

    /**
     * Уведомления о сообществе настраивает тот, кто в нём состоит: строка
     * настройки живёт в community_members, и вне участия её попросту нет.
     */
    public function notifications(User $user, Community $community): bool
    {
        return $this->isMember($user, $community);
    }

    /**
     * Избранное — личная закладка, а не участие: закладку можно поставить и
     * на сообщество, куда ещё не вступил.
     */
    public function favorite(User $user, Community $community): bool
    {
        return $this->isActive($community);
    }

    private function isActive(Community $community): bool
    {
        return $community->status === CommunityStatus::Active;
    }

    /**
     * Участие смотрящего.
     *
     * Список сообществ уже спрашивает роли одним запросом на страницу и
     * кладёт ответ в атрибуты `viewer_id` и `viewer_role`. Политика их и
     * использует: пять её вызовов на карточку × двадцать карточек — это сто
     * запросов там, где хватает одного. Проверка `viewer_id` обязательна:
     * атрибут посчитан для конкретного человека, и отдавать его чужому
     * ответу нельзя.
     */
    private function isMember(User $user, Community $community): bool
    {
        $cached = $this->cachedRole($user, $community);

        if ($cached !== false) {
            return $cached !== null;
        }

        if ($community->relationLoaded('members')) {
            return $community->members->contains(fn (User $m) => (int) $m->id === (int) $user->id);
        }

        return $community->members()->where('users.id', $user->id)->exists();
    }

    private function isOwner(User $user, Community $community): bool
    {
        $cached = $this->cachedRole($user, $community);

        if ($cached !== false) {
            return $cached === CommunityMemberRole::Owner->value;
        }

        return $community->isOwnedBy($user);
    }

    private function canManage(User $user, Community $community): bool
    {
        if ($user->isModerator()) {
            return true;
        }

        $cached = $this->cachedRole($user, $community);

        if ($cached !== false) {
            return in_array(
                $cached,
                [CommunityMemberRole::Owner->value, CommunityMemberRole::Moderator->value],
                true,
            );
        }

        return $community->canManage($user);
    }

    /**
     * Заранее посчитанная роль: `false` — кэша нет, `null` — не участник,
     * строка — роль. Три состояния, поэтому не `?string`.
     */
    private function cachedRole(User $user, Community $community): string|null|false
    {
        $viewerId = $community->getAttribute('viewer_id');

        if ($viewerId === null || (int) $viewerId !== (int) $user->id) {
            return false;
        }

        $role = $community->getAttribute('viewer_role');

        return $role === null ? null : (string) $role;
    }
}
