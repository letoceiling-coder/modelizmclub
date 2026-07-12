<?php

namespace Modules\Auth\Services;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private readonly EmailVerificationService $verificationService,
    ) {}

    public function register(
        string $email,
        string $password,
        RegistrationTrack $track,
        ?string $displayName = null,
        ?string $referralCode = null,
        ?string $phone = null,
    ): User {
        $email = Str::lower($email);

        if (User::withTrashed()->where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['Пользователь с таким email уже зарегистрирован.'],
            ]);
        }

        $referrer = $referralCode
            ? User::query()->whereRaw('upper(referral_code) = ?', [Str::upper(trim($referralCode))])->first()
            : null;

        return DB::transaction(function () use ($email, $password, $track, $displayName, $referrer, $phone): User {
            $user = User::create([
                'name' => $displayName,
                'email' => $email,
                'phone' => $phone,
                'password' => $password,
                'role' => UserRole::User,
                'status' => UserStatus::PendingVerification,
                'registration_track' => $track,
                'referred_by' => $referrer?->id,
            ]);

            $user->ensureReferralCode();

            $this->verificationService->issueCode($user);

            return $user;
        });
    }

    public function verifyEmail(string $email, string $code): array
    {
        $email = Str::lower($email);
        $user = User::where('email', $email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['Пользователь не найден.'],
            ]);
        }

        if ($user->status === UserStatus::Active && $user->email_verified_at) {
            throw ValidationException::withMessages([
                'email' => ['Email уже подтверждён. Выполните вход.'],
            ]);
        }

        $verification = EmailVerificationCode::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        if (! $verification || ! $verification->isValid($code)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный или просроченный код подтверждения.'],
            ]);
        }

        return DB::transaction(function () use ($user, $verification): array {
            $verification->update(['used_at' => now()]);

            $user->forceFill([
                'email_verified_at' => now(),
                'status' => UserStatus::Active,
            ])->save();

            if (! $user->profile) {
                $this->createProfile($user);
            }

            if (! $user->hasRole('user')) {
                $user->assignRole('user');
            }

            $user->load('profile');

            return $this->tokenResponse($user);
        });
    }

    public function login(string $email, string $password): array
    {
        $email = Str::lower($email);
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, (string) $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Неверный email или пароль.'],
            ]);
        }

        if ($user->status === UserStatus::PendingVerification) {
            throw ValidationException::withMessages([
                'email' => ['Подтвердите email перед входом.'],
            ]);
        }

        if ($user->status === UserStatus::Blocked) {
            throw ValidationException::withMessages([
                'email' => ['Аккаунт заблокирован.'],
            ]);
        }

        if (! $user->profile) {
            $this->createProfile($user);
        }

        $user->forceFill(['last_seen_at' => now()])->save();

        return $this->tokenResponse($user);
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    private function createProfile(User $user): UserProfile
    {
        $base = $user->name ?: Str::before($user->email, '@');
        $slug = $this->uniqueSlug($base);

        return UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $user->name ?: $base,
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

    private function tokenResponse(User $user): array
    {
        $user->loadMissing('profile');

        return [
            'user' => $user,
            'token' => $user->createToken('api')->plainTextToken,
        ];
    }
}
