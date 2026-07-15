<?php

namespace Modules\Auth\Services;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Models\UserProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class OAuthService
{
    /** Find or create a user from a Socialite profile and issue a Sanctum token. */
    public function resolveUser(string $provider, SocialiteUser $socialUser): array
    {
        $providerUserId = (string) $socialUser->getId();

        $linked = UserOAuthAccount::query()
            ->where('provider', $provider)
            ->where('provider_user_id', $providerUserId)
            ->first();

        if ($linked) {
            $user = $linked->user;
            $linked->update(['token' => $this->tokenPayload($socialUser)]);
            $this->ensureActiveUser($user);

            return $this->tokenResponse($user);
        }

        $email = Str::lower((string) ($socialUser->getEmail() ?? ''));

        if ($email !== '') {
            $existing = User::query()->where('email', $email)->first();
            if ($existing) {
                $this->linkAccount($existing, $provider, $providerUserId, $socialUser);
                $this->ensureActiveUser($existing);

                return $this->tokenResponse($existing);
            }
        }

        return DB::transaction(function () use ($provider, $providerUserId, $socialUser, $email): array {
            $name = $socialUser->getName() ?: $socialUser->getNickname() ?: 'Пользователь';

            $user = User::create([
                'name' => $name,
                'email' => $email !== '' ? $email : $this->syntheticEmail($provider, $providerUserId),
                'password' => Str::password(32),
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'registration_track' => RegistrationTrack::Social,
                'email_verified_at' => $email !== '' ? now() : null,
            ]);

            $user->ensureReferralCode();
            $this->createProfile($user, $name);
            $user->assignRole('user');
            $this->linkAccount($user, $provider, $providerUserId, $socialUser);

            return $this->tokenResponse($user);
        });
    }

    private function linkAccount(User $user, string $provider, string $providerUserId, SocialiteUser $socialUser): void
    {
        UserOAuthAccount::query()->updateOrCreate(
            ['provider' => $provider, 'provider_user_id' => $providerUserId],
            ['user_id' => $user->id, 'token' => $this->tokenPayload($socialUser)],
        );
    }

    private function ensureActiveUser(User $user): void
    {
        if ($user->status === UserStatus::Blocked) {
            abort(403, 'Аккаунт заблокирован.');
        }

        if (! $user->profile) {
            $this->createProfile($user, $user->name ?? 'Пользователь');
        }

        $user->forceFill(['last_seen_at' => now()])->save();
    }

    private function createProfile(User $user, string $displayName): UserProfile
    {
        $slug = $this->uniqueSlug($displayName);

        return UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $displayName,
            'slug' => $slug,
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);
    }

    private function uniqueSlug(string $base): string
    {
        $slug = Str::slug($base) ?: 'user';
        $original = $slug;
        $suffix = 1;

        while (UserProfile::where('slug', $slug)->exists()) {
            $slug = $original.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function syntheticEmail(string $provider, string $providerUserId): string
    {
        return "{$provider}_{$providerUserId}@oauth.modelizmclub.local";
    }

    /** @return array<string, mixed> */
    private function tokenPayload(SocialiteUser $socialUser): array
    {
        return array_filter([
            'access_token' => $socialUser->token ?? null,
            'refresh_token' => $socialUser->refreshToken ?? null,
            'expires_in' => $socialUser->expiresIn ?? null,
        ]);
    }

    /** @return array{user: User, token: string} */
    private function tokenResponse(User $user): array
    {
        $user->loadMissing('profile');

        return [
            'user' => $user,
            'token' => $user->createToken('api')->plainTextToken,
        ];
    }
}
