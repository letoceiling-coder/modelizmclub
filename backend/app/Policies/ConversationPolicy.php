<?php

namespace App\Policies;

use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Modules\User\Services\FriendService;

/**
 * Viewing needs participation; writing needs participation *and* either
 * confirmed mutual friendship with the other person, the subscriber rung, or
 * — с 06.10, решение Е6 — то, что переписку начал не ты.
 *
 * Личную переписку открывает дружба либо подписка — решение владельца от
 * 05.10. До него сервер требовал подписку всегда, а интерфейс спрашивал
 * дружбу: на профиле «Написать» проверяет `is_friend` и предлагает окно
 * «Добавьте пользователя в друзья». Друг без подписки проходил проверку
 * клиента и получал 403 от сервера, после чего ему показывали окно
 * подписки — то есть просили заплатить за то, что по правилу открыто.
 *
 * Дружба считается подтверждённой, когда обе строки `user_friendships` на
 * месте: их ставит `FriendService::attachFriendship` при принятии заявки и
 * снимает `detachFriendship` при удалении из друзей. Поэтому удаление из
 * друзей закрывает переписку само, без отдельной проверки.
 *
 * Прочие условия не менялись: участие в диалоге, блокировки (их держит
 * `UserService::assertCanInteract`), подтверждение телефона, чаты сделок и
 * чаты направлений. Модератор обходит подписку, но не участие.
 */
class ConversationPolicy
{
    public const SUBSCRIPTION_REQUIRED_MESSAGE = 'Оформите подписку, чтобы писать в чатах.';

    public const FRIENDSHIP_REQUIRED_MESSAGE = 'Добавьте пользователя в друзья, чтобы написать ему.';

    public function __construct(private readonly FriendService $friends) {}

    public function view(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    /**
     * Start a direct conversation with another user.
     *
     * `$other` приходит из контроллера вторым аргументом `can()`. Без него
     * решает только подписка: так вызывают места, где получателя ещё нет.
     */
    public function create(User $user, ?User $other = null): Response
    {
        if ($this->isSubscriber($user)) {
            return Response::allow();
        }

        if ($other && $this->areFriends($user, $other)) {
            return Response::allow();
        }

        return $other
            ? Response::deny(self::FRIENDSHIP_REQUIRED_MESSAGE, 'friendship_required')
            : Response::deny('Оформите подписку, чтобы начинать переписку.', 'subscription_required');
    }

    /**
     * Отказ несёт код: клиент по нему открывает нужное окно — подписки или
     * «добавьте в друзья». Без кода человек видел «Это действие не
     * авторизовано» — так было у подписчика, чья оплата не засчиталась (15.09).
     */
    public function send(User $user, Conversation $conversation): Response
    {
        if (! $this->isParticipant($user, $conversation)) {
            return Response::deny();
        }

        // A deal chat belongs to the two parties of the deal — buying or selling
        // is not a social feature, so no subscription is required there.
        if ($conversation->type === ConversationType::Deal) {
            return Response::allow();
        }

        if ($this->isSubscriber($user)) {
            return Response::allow();
        }

        /*
         * Дружба открывает только личную переписку. Чаты направлений,
         * сообществ и групп остаются за подпиской: там собеседник не один и
         * «взаимная дружба» к ним не применима.
         */
        if ($conversation->type === ConversationType::Direct) {
            $other = $this->otherDirectParticipant($user, $conversation);

            if ($other && $this->areFriends($user, $other)) {
                return Response::allow();
            }

            /*
             * Отвечать можно в переписке, которую начал не ты.
             *
             * Решение владельца Е6 от 06.10. До него человеку могли
             * написать — подписчик вправе написать кому угодно, — а ответить
             * он не мог: ни подписки, ни дружбы. Переписка выходила
             * односторонней, и это выглядело поломкой, а не правилом. Случай
             * был назван ещё в сессии 4 и оставлен владельцу вопросом;
             * поведение тогда не меняли.
             *
             * Начать новую переписку это по-прежнему не позволяет: `create`
             * выше не тронут, и с третьим лицом без подписки и дружбы
             * заговорить нельзя. Блокировки тоже на месте — их держит
             * `UserService::assertCanInteract` на входе в отправку.
             */
            if ($this->startedBySomeoneElse($user, $conversation)) {
                return Response::allow();
            }

            return Response::deny(self::FRIENDSHIP_REQUIRED_MESSAGE, 'friendship_required');
        }

        return Response::deny(self::SUBSCRIPTION_REQUIRED_MESSAGE, 'subscription_required');
    }

    public function delete(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    public function pin(User $user, Conversation $conversation): bool
    {
        return $this->isParticipant($user, $conversation);
    }

    private function isSubscriber(User $user): bool
    {
        return $user->hasSubscriptionAccess();
    }

    /**
     * Подтверждённая взаимная дружба.
     *
     * Своего запроса не завожу: `FriendService::areFriends` уже спрашивает
     * ту же таблицу, которую пишет при принятии заявки, и остаётся верным,
     * если хранение дружбы когда-нибудь поменяется.
     */
    private function areFriends(User $a, User $b): bool
    {
        return $this->friends->areFriends($a, $b);
    }

    /**
     * Переписку начал кто-то другой: первое сообщение в ней не твоё.
     *
     * «Начал» считается по первому сообщению, а не по строке участника:
     * `findOrCreateDirect` ставит обоим `role => member` и один и тот же
     * `joined_at`, то есть по участникам инициатора не отличить.
     *
     * Удалённые сообщения учитываются (`withTrashed`): иначе собеседник,
     * убрав у себя своё первое сообщение, закрыл бы человеку возможность
     * ответить на остальные.
     *
     * Пустая переписка — без сообщений вовсе — права не даёт: начать её
     * мог только подписчик или друг, и до первого слова отвечать не на что.
     */
    private function startedBySomeoneElse(User $user, Conversation $conversation): bool
    {
        $firstSenderId = $conversation->messages()
            ->withTrashed()
            ->orderBy('id')
            ->value('user_id');

        return $firstSenderId !== null && (int) $firstSenderId !== (int) $user->id;
    }

    /** Собеседник в личной переписке — тот участник, который не ты. */
    private function otherDirectParticipant(User $user, Conversation $conversation): ?User
    {
        $participant = $conversation->participants()
            ->where('user_id', '!=', $user->id)
            ->whereNull('left_at')
            ->first();

        return $participant?->user;
    }

    private function isParticipant(User $user, Conversation $conversation): bool
    {
        if ($conversation->relationLoaded('participants')) {
            return $conversation->participants
                ->contains(fn ($p) => (int) $p->user_id === (int) $user->id && $p->left_at === null);
        }

        return $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }
}
