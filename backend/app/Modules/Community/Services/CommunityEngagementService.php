<?php

namespace Modules\Community\Services;

use App\Models\Community;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * То, что человек делает вокруг сообщества, а не с ним самим: уведомления,
 * закладка, похожие, приглашения друзьям.
 *
 * Отдельно от CommunityService намеренно — тот отвечает за жизненный цикл
 * (заявка, вступление, настройки, удаление) и уже перевалил за четыреста
 * строк. Здесь ни одна операция не меняет само сообщество.
 */
class CommunityEngagementService
{
    /** Сколько похожих сообществ показываем. */
    public const SIMILAR_LIMIT = 5;

    /** За один раз — не больше стольких приглашений. */
    public const INVITE_MAX = 20;

    /**
     * Включить или выключить уведомления сообщества для участника.
     *
     * Возвращает состояние, которое получилось: клиент рисует переключатель
     * по ответу, а не по своей догадке.
     */
    public function setNotifications(User $user, Community $community, bool $enabled): bool
    {
        $updated = DB::table('community_members')
            ->where('community_id', $community->id)
            ->where('user_id', $user->id)
            ->update(['notifications_enabled' => $enabled]);

        if ($updated === 0) {
            throw ValidationException::withMessages([
                'community' => ['Вы не состоите в этом сообществе.'],
            ]);
        }

        return $enabled;
    }

    public function notificationsEnabled(?User $user, Community $community): ?bool
    {
        if ($user === null) {
            return null;
        }

        $value = DB::table('community_members')
            ->where('community_id', $community->id)
            ->where('user_id', $user->id)
            ->value('notifications_enabled');

        return $value === null ? null : (bool) $value;
    }

    /** Повторное добавление не ошибка: кнопка идемпотентна. */
    public function addFavorite(User $user, Community $community): void
    {
        DB::table('community_favorites')->insertOrIgnore([
            'user_id' => $user->id,
            'community_id' => $community->id,
            'created_at' => now(),
        ]);
    }

    public function removeFavorite(User $user, Community $community): void
    {
        DB::table('community_favorites')
            ->where('user_id', $user->id)
            ->where('community_id', $community->id)
            ->delete();
    }

    public function isFavorite(?User $user, Community $community): bool
    {
        if ($user === null) {
            return false;
        }

        return DB::table('community_favorites')
            ->where('user_id', $user->id)
            ->where('community_id', $community->id)
            ->exists();
    }

    /**
     * Похожие сообщества — по совпадению категорий.
     *
     * Совпадением считается основная категория либо любая из тем
     * (community_topic_categories). Чем больше общих тем, тем выше в списке;
     * при равенстве вперёд идёт то, где больше участников, — на пустой
     * выдаче это единственный осмысленный порядок.
     *
     * @return Collection<int, Community>
     */
    public function similar(Community $community, int $limit = self::SIMILAR_LIMIT): Collection
    {
        $topicIds = DB::table('community_topic_categories')
            ->where('community_id', $community->id)
            ->pluck('post_category_id');

        $query = Community::query()
            ->active()
            ->whereNot('id', $community->id)
            ->with(['category', 'avatar', 'cover'])
            ->select('communities.*');

        if ($topicIds->isNotEmpty()) {
            // Число общих тем считаем подзапросом, а не join'ом с group by:
            // join размножил бы строки и сломал бы with().
            $query->selectSub(
                DB::table('community_topic_categories')
                    ->selectRaw('count(*)')
                    ->whereColumn('community_topic_categories.community_id', 'communities.id')
                    ->whereIn('community_topic_categories.post_category_id', $topicIds),
                'shared_topics',
            );
        } else {
            $query->selectRaw('0 as shared_topics');
        }

        $query->where(function ($q) use ($community, $topicIds): void {
            $q->where('category_id', $community->category_id);

            if ($topicIds->isNotEmpty()) {
                $q->orWhereExists(function ($sub) use ($topicIds): void {
                    $sub->select(DB::raw(1))
                        ->from('community_topic_categories')
                        ->whereColumn('community_topic_categories.community_id', 'communities.id')
                        ->whereIn('community_topic_categories.post_category_id', $topicIds);
                });
            }
        });

        return $query
            ->orderByDesc('shared_topics')
            ->orderByDesc('members_count')
            ->orderBy('id')
            ->limit(max(1, $limit))
            ->get();
    }

    /**
     * Друзья, которых ещё нет в сообществе.
     *
     * Приглашать того, кто уже внутри, некуда, а показывать его в списке —
     * значит предлагать действие, которое ничего не сделает.
     *
     * @return Collection<int, User>
     */
    public function invitableFriends(User $user, Community $community): Collection
    {
        return $user->friends()
            ->with(['profile.avatar', 'profile.city'])
            ->whereNotExists(function ($q) use ($community): void {
                $q->select(DB::raw(1))
                    ->from('community_members')
                    ->whereColumn('community_members.user_id', 'users.id')
                    ->where('community_members.community_id', $community->id);
            })
            ->orderBy('users.id')
            ->get();
    }

    /**
     * Разослать приглашения.
     *
     * Молча пропускаем тех, кто не друг или уже внутри: список у клиента мог
     * устареть между открытием окна и нажатием, и падать из-за этого незачем.
     *
     * @param  array<int, string>  $userUuids
     * @return int Сколько приглашений ушло
     */
    public function invite(User $inviter, Community $community, array $userUuids): int
    {
        if ($userUuids === []) {
            return 0;
        }

        $candidates = $this->invitableFriends($inviter, $community)
            ->whereIn('uuid', array_slice($userUuids, 0, self::INVITE_MAX));

        foreach ($candidates as $friend) {
            InAppNotify::sendQuiet(
                $friend,
                new InAppNotification(
                    'community_invite',
                    'Приглашение в сообщество',
                    $inviter->name.' зовёт вас в «'.$community->name.'»',
                    '/communities/'.$community->slug,
                ),
            );
        }

        return $candidates->count();
    }
}
