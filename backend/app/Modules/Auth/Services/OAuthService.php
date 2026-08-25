<?php

namespace Modules\Auth\Services;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Models\UserProfile;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class OAuthService
{
    /** Find or create a user from a Socialite profile and issue a Sanctum token. */
    public function resolveUser(string $provider, SocialiteUser $socialUser): array
    {
        $providerUserId = (string) $socialUser->getId();
        $email = Str::lower((string) ($socialUser->getEmail() ?? ''));

        $linked = UserOAuthAccount::query()
            ->where('provider', $provider)
            ->where('provider_user_id', $providerUserId)
            ->first();

        if ($linked) {
            $user = $linked->user;
            $linked->update(['token' => $this->tokenPayload($socialUser)]);
            $this->ensureActiveUser($user);
            $this->syncProfileFromOAuth($user, $socialUser);
            $this->applyProviderVerification($user, $provider, $email);
            app(\Modules\Billing\Services\FirstHundredService::class)->tryGrant($user->fresh());

            return $this->tokenResponse($user);
        }

        if ($email !== '') {
            $existing = User::query()->where('email', $email)->first();
            if ($existing) {
                $this->linkAccount($existing, $provider, $providerUserId, $socialUser);
                $this->ensureActiveUser($existing);
                $this->syncProfileFromOAuth($existing, $socialUser);
                $this->applyProviderVerification($existing, $provider, $email);
                app(\Modules\Billing\Services\FirstHundredService::class)->tryGrant($existing->fresh());

                return $this->tokenResponse($existing);
            }
        }

        return DB::transaction(function () use ($provider, $providerUserId, $socialUser, $email): array {
            $name = $socialUser->getName() ?: $socialUser->getNickname() ?: 'Пользователь';

        $phone = $this->extractPhone($socialUser);
        if ($phone !== null && User::withTrashed()->where('phone', $phone)->exists()) {
            $phone = null;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email !== '' ? $email : $this->syntheticEmail($provider, $providerUserId),
            'phone' => $phone,
                'password' => Str::password(32),
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'registration_track' => RegistrationTrack::Social,
                'email_verified_at' => $this->initialEmailVerifiedAt($provider, $email),
                'phone_verified_at' => null,
            ]);

            $user->ensureReferralCode();
            $this->createProfile($user, $name);
            $user->assignRole('user');
            $this->linkAccount($user, $provider, $providerUserId, $socialUser);
            $this->syncProfileFromOAuth($user, $socialUser);
            $this->applyProviderVerification($user, $provider, $email);
            app(\Modules\Billing\Services\FirstHundredService::class)->tryGrant($user->fresh());

            return $this->tokenResponse($user);
        });
    }

    /**
     * VK: identity verified by VK ID — never require email confirmation.
     * Yandex: email from provider is trusted — auto-verify and link by email above.
     */
    private function applyProviderVerification(User $user, string $provider, string $email): void
    {
        if (in_array($provider, ['vk', 'max'], true)) {
            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            return;
        }

        if ($provider === 'yandex' && $email !== '' && $user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
    }

    private function initialEmailVerifiedAt(string $provider, string $email): ?\Illuminate\Support\Carbon
    {
        if (in_array($provider, ['vk', 'max'], true)) {
            return now();
        }

        if ($provider === 'yandex' && $email !== '') {
            return now();
        }

        return $email !== '' ? now() : null;
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

    private function syncProfileFromOAuth(User $user, SocialiteUser $socialUser): void
    {
        $phone = $this->extractPhone($socialUser);
        if ($phone === null) {
            return;
        }

        if (filled($user->phone) && $user->phone === $phone) {
            return;
        }

        if (filled($user->phone)) {
            return;
        }

        if (User::withTrashed()->where('phone', $phone)->where('id', '!=', $user->id)->exists()) {
            return;
        }

        try {
            $user->forceFill([
                'phone' => $phone,
            ])->save();
        } catch (UniqueConstraintViolationException) {
            $user->refresh();
        }
    }

    private function extractPhone(SocialiteUser $socialUser): ?string
    {
        $raw = $socialUser->getRaw();
        if (! is_array($raw)) {
            return null;
        }

        $phone = $raw['phone']
            ?? $raw['phone_number']
            ?? ($raw['default_phone']['number'] ?? null)
            ?? (is_string($raw['default_phone'] ?? null) ? $raw['default_phone'] : null);

        if (! is_string($phone) || trim($phone) === '') {
            return null;
        }

        return $this->normalizePhone($phone);
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '8') && strlen($digits) === 11) {
            $digits = '7'.substr($digits, 1);
        } elseif (strlen($digits) === 10) {
            $digits = '7'.$digits;
        }

        return $digits !== '' ? '+'.$digits : trim($phone);
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
        $user->loadMissing(['profile', 'oauthAccounts']);

        return [
            'user' => $user,
            'token' => $user->createToken('api')->plainTextToken,
        ];
    }
}
