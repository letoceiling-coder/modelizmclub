<?php

namespace Modules\Legal\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class UserAccountDeletionService
{
    public function delete(User $user): void
    {
        DB::transaction(function () use ($user): void {
            PersonalAccessToken::query()->where('tokenable_id', $user->id)->delete();

            $user->forceFill([
                'name' => 'Deleted user',
                'email' => 'deleted-'.$user->uuid.'@deleted.modelizmclub.local',
                'phone' => null,
                'password' => Str::password(32),
            ])->save();

            $user->tokens()->delete();
            $user->delete();
        });
    }
}
