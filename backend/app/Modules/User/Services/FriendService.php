<?php

namespace Modules\User\Services;

use App\Enums\FriendRequestStatus;
use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Friends vs follows:
 * - Follow = one-way subscription (feed «Подписки»).
 * - Friend = mutual relationship after accepted request (or auto-accept on cross-request).
 * - Accepting a friend request also creates mutual follows.
 */
class FriendService
{
    public function __construct(private UserService $users) {}

    public function sendRequest(User $from, User $to): FriendRequest
    {
        $this->users->assertCanInteract($from, $to);

        if ($this->areFriends($from, $to)) {
            throw ValidationException::withMessages([
                'user' => ['Вы уже друзья.'],
            ]);
        }

        $incoming = FriendRequest::query()
            ->where('from_user_id', $to->id)
            ->where('to_user_id', $from->id)
            ->where('status', FriendRequestStatus::Pending)
            ->first();

        if ($incoming) {
            return $this->acceptRequest($from, $incoming);
        }

        $existing = FriendRequest::query()
            ->where('from_user_id', $from->id)
            ->where('to_user_id', $to->id)
            ->where('status', FriendRequestStatus::Pending)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'user' => ['Заявка уже отправлена.'],
            ]);
        }

        return FriendRequest::query()->create([
            'from_user_id' => $from->id,
            'to_user_id' => $to->id,
            'status' => FriendRequestStatus::Pending,
        ]);
    }

    public function acceptRequest(User $actor, FriendRequest $request): FriendRequest
    {
        if ($request->to_user_id !== $actor->id) {
            throw ValidationException::withMessages([
                'request' => ['Нельзя принять эту заявку.'],
            ]);
        }

        if ($request->status !== FriendRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'request' => ['Заявка уже обработана.'],
            ]);
        }

        $from = $request->fromUser ?? User::query()->findOrFail($request->from_user_id);
        $this->users->assertCanInteract($actor, $from);

        DB::transaction(function () use ($request, $actor, $from): void {
            $request->update([
                'status' => FriendRequestStatus::Accepted,
                'responded_at' => now(),
            ]);

            $this->attachFriendship($from, $actor);

            FriendRequest::query()
                ->where('status', FriendRequestStatus::Pending)
                ->where('id', '!=', $request->id)
                ->where(function ($q) use ($from, $actor): void {
                    $q->where(function ($inner) use ($from, $actor): void {
                        $inner->where('from_user_id', $from->id)->where('to_user_id', $actor->id);
                    })->orWhere(function ($inner) use ($from, $actor): void {
                        $inner->where('from_user_id', $actor->id)->where('to_user_id', $from->id);
                    });
                })
                ->update([
                    'status' => FriendRequestStatus::Cancelled,
                    'responded_at' => now(),
                ]);

            $this->users->follow($from, $actor);
            $this->users->follow($actor, $from);
        });

        return $request->fresh(['fromUser.profile.avatar', 'toUser.profile.avatar']);
    }

    public function declineRequest(User $actor, FriendRequest $request): FriendRequest
    {
        if ($request->to_user_id !== $actor->id) {
            throw ValidationException::withMessages([
                'request' => ['Нельзя отклонить эту заявку.'],
            ]);
        }

        if ($request->status !== FriendRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'request' => ['Заявка уже обработана.'],
            ]);
        }

        $request->update([
            'status' => FriendRequestStatus::Declined,
            'responded_at' => now(),
        ]);

        return $request->fresh();
    }

    public function cancelRequest(User $actor, FriendRequest $request): FriendRequest
    {
        if ($request->from_user_id !== $actor->id) {
            throw ValidationException::withMessages([
                'request' => ['Нельзя отменить эту заявку.'],
            ]);
        }

        if ($request->status !== FriendRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'request' => ['Заявка уже обработана.'],
            ]);
        }

        $request->update([
            'status' => FriendRequestStatus::Cancelled,
            'responded_at' => now(),
        ]);

        return $request->fresh();
    }

    public function removeFriend(User $actor, User $friend): void
    {
        $this->users->assertCanInteract($actor, $friend);

        if (! $this->areFriends($actor, $friend)) {
            throw ValidationException::withMessages([
                'user' => ['Пользователь не в списке друзей.'],
            ]);
        }

        DB::transaction(function () use ($actor, $friend): void {
            $this->detachFriendship($actor, $friend);
        });
    }

    /** @return LengthAwarePaginator<int, User> */
    public function listFriends(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return $user->friends()
            ->with(['profile.avatar', 'profile.city'])
            ->orderByDesc('user_friendships.created_at')
            ->paginate($perPage);
    }

    /** @return Collection<int, FriendRequest> */
    public function listIncomingPending(User $user): Collection
    {
        return FriendRequest::query()
            ->with(['fromUser.profile.avatar', 'fromUser.profile.city'])
            ->where('to_user_id', $user->id)
            ->where('status', FriendRequestStatus::Pending)
            ->orderByDesc('created_at')
            ->get();
    }

    public function areFriends(User $a, User $b): bool
    {
        return DB::table('user_friendships')
            ->where('user_id', $a->id)
            ->where('friend_id', $b->id)
            ->exists();
    }

    private function attachFriendship(User $a, User $b): void
    {
        if ($this->areFriends($a, $b)) {
            return;
        }

        DB::table('user_friendships')->insert([
            ['user_id' => $a->id, 'friend_id' => $b->id, 'created_at' => now()],
            ['user_id' => $b->id, 'friend_id' => $a->id, 'created_at' => now()],
        ]);

        UserProfile::where('user_id', $a->id)->increment('friends_count');
        UserProfile::where('user_id', $b->id)->increment('friends_count');
    }

    private function detachFriendship(User $a, User $b): void
    {
        $deleted = DB::table('user_friendships')
            ->where(function ($q) use ($a, $b): void {
                $q->where('user_id', $a->id)->where('friend_id', $b->id);
            })
            ->orWhere(function ($q) use ($a, $b): void {
                $q->where('user_id', $b->id)->where('friend_id', $a->id);
            })
            ->delete();

        if ($deleted > 0) {
            UserProfile::where('user_id', $a->id)->where('friends_count', '>', 0)->decrement('friends_count');
            UserProfile::where('user_id', $b->id)->where('friends_count', '>', 0)->decrement('friends_count');
        }
    }
}
