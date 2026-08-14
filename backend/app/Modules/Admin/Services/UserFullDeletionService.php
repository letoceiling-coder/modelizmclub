<?php

namespace Modules\Admin\Services;

use App\Enums\CommunityMemberRole;
use App\Models\Channel;
use App\Models\Community;
use App\Models\Media;
use App\Models\ModerationQueue;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Permanently removes a user and all owned / linked records from the database.
 */
class UserFullDeletionService
{
    public function purge(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $userId = $user->id;

            Channel::withTrashed()
                ->where('owner_id', $userId)
                ->each(fn (Channel $channel) => $channel->forceDelete());

            $ownedCommunityIds = Community::withTrashed()
                ->where('created_by', $userId)
                ->pluck('id');

            if (Schema::hasTable('community_members')) {
                $pivotOwned = DB::table('community_members')
                    ->where('user_id', $userId)
                    ->where('role', CommunityMemberRole::Owner->value)
                    ->pluck('community_id');
                $ownedCommunityIds = $ownedCommunityIds->merge($pivotOwned)->unique();
            }

            Community::withTrashed()
                ->whereIn('id', $ownedCommunityIds)
                ->each(function (Community $community): void {
                    ModerationQueue::query()
                        ->where('moderatable_type', Community::class)
                        ->where('moderatable_id', $community->id)
                        ->delete();
                    $community->forceDelete();
                });

            Media::query()->where('uploaded_by', $userId)->delete();

            if (Schema::hasTable('icon_assets')) {
                DB::table('icon_assets')->where('uploaded_by', $userId)->delete();
            }

            foreach ([
                'feedback',
                'client_logs',
                'audit_logs',
                'banner_events',
                'consent_logs',
            ] as $table) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id')) {
                    DB::table($table)->where('user_id', $userId)->delete();
                }
            }

            if (Schema::hasTable('promocodes')) {
                DB::table('promocodes')->where('user_id', $userId)->update(['user_id' => null]);
            }

            User::withTrashed()->where('referred_by', $userId)->update(['referred_by' => null]);

            PersonalAccessToken::query()
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $userId)
                ->delete();

            if (Schema::hasTable('sessions')) {
                DB::table('sessions')->where('user_id', $userId)->delete();
            }

            foreach (['model_has_roles', 'model_has_permissions'] as $pivot) {
                if (Schema::hasTable($pivot)) {
                    DB::table($pivot)
                        ->where('model_type', User::class)
                        ->where('model_id', $userId)
                        ->delete();
                }
            }

            $user->forceDelete();
        });
    }

    public function purgeByEmail(string $email): ?User
    {
        $user = User::withTrashed()
            ->whereRaw('LOWER(email) = ?', [strtolower(trim($email))])
            ->first();

        if (! $user) {
            return null;
        }

        $this->purge($user);

        return $user;
    }
}
