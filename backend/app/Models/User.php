<?php

namespace App\Models;

use App\Enums\RegistrationTrack;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Concerns\HasPublicUuid;
use App\Support\FirstHundredPromo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Modules\Auth\Notifications\ResetPasswordNotification;
use Modules\Billing\Services\PaymentGatewayManager;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use HasPublicUuid;
    use HasRoles;
    use Notifiable;
    use SoftDeletes;

    protected $guard_name = 'api';

    protected $fillable = [
        'uuid',
        'name',
        'email',
        'phone',
        'password',
        'role',
        'status',
        'registration_track',
        'referral_code',
        'referred_by',
        'is_first_hundred',
        'first_hundred_granted_at',
        'locale',
        'last_seen_at',
        'email_verified_at',
        'phone_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'registration_track' => RegistrationTrack::class,
            'is_first_hundred' => 'boolean',
            'first_hundred_granted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (self $user): void {
            if ($user->isDirty('email') && is_string($user->email)) {
                $user->email = Str::lower(trim($user->email));
            }
        });
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    public function interests(): BelongsToMany
    {
        return $this->belongsToMany(PostCategory::class, 'user_interests', 'user_id', 'category_id');
    }

    public function following(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'user_follows', 'follower_id', 'following_id')
            ->withPivot('created_at');
    }

    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'user_follows', 'following_id', 'follower_id')
            ->withPivot('created_at');
    }

    public function blockedUsers(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'user_blocks', 'blocker_id', 'blocked_id')
            ->withPivot(['reason', 'created_at', 'updated_at']);
    }

    public function blockedByUsers(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'user_blocks', 'blocked_id', 'blocker_id')
            ->withPivot(['reason', 'created_at', 'updated_at']);
    }

    public function notificationPreferences(): HasMany
    {
        return $this->hasMany(NotificationPreference::class);
    }

    public function consentLogs(): HasMany
    {
        return $this->hasMany(ConsentLog::class);
    }

    public function friends(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'user_friendships', 'user_id', 'friend_id')
            ->withPivot('created_at');
    }

    public function referrer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(self::class, 'referred_by');
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(self::class, 'referred_by');
    }

    public function oauthAccounts(): HasMany
    {
        return $this->hasMany(UserOAuthAccount::class);
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(UserSubscription::class);
    }

    /** True when the user currently holds an active, non-expired subscription. */
    public function hasActiveSubscription(): bool
    {
        if (! $this->hasUnexpiredSubscriptionRow()) {
            return false;
        }

        if ($this->hasPaidSubscriptionPayment()) {
            return true;
        }

        if ($this->is_first_hundred) {
            return FirstHundredPromo::coversUser($this);
        }

        return false;
    }

    public function hasUnexpiredSubscriptionRow(): bool
    {
        return UserSubscription::query()
            ->where('user_id', $this->id)
            ->where('status', 'active')
            ->where(function ($q): void {
                $q->whereNull('ends_at')->orWhere('ends_at', '>', now());
            })
            ->exists();
    }

    /** Paid gateway/wallet checkout for a subscription plan. */
    public function hasPaidSubscriptionPayment(): bool
    {
        $query = Payment::query()
            ->where('user_id', $this->id)
            ->where('status', 'paid')
            ->where(function ($q): void {
                $q->whereNotNull('metadata->plan_id')
                    ->orWhere('metadata->payable_type', 'subscription');
            });

        // Live VTB ignores leftover stub checkouts. Test acquiring (stub) is a real paid path.
        if (app(PaymentGatewayManager::class)->provider() !== 'stub') {
            $query->where('provider', '!=', 'stub');
        }

        return $query->exists();
    }

    /** OAuth placeholder emails — not a real inbox, must not be shown or verified manually. */
    public static function isSyntheticOAuthEmail(?string $email): bool
    {
        return is_string($email) && str_ends_with(strtolower($email), '@oauth.modelizmclub.local');
    }

    public function hasOAuthProvider(string $provider): bool
    {
        if ($this->relationLoaded('oauthAccounts')) {
            return $this->oauthAccounts->contains(
                fn (UserOAuthAccount $account): bool => $account->provider === $provider,
            );
        }

        return $this->oauthAccounts()->where('provider', $provider)->exists();
    }

    /** VK identity is verified by the provider — email confirmation must never be required. */
    public function isVkOAuthUser(): bool
    {
        return $this->hasOAuthProvider('vk');
    }

    public function requiresEmailVerification(): bool
    {
        if ($this->email_verified_at !== null) {
            return false;
        }

        if ($this->isVkOAuthUser()) {
            return false;
        }

        if (self::isSyntheticOAuthEmail($this->email)) {
            return false;
        }

        return true;
    }

    /** Email suitable for display in account settings (hides OAuth placeholders). */
    public function displayEmail(): ?string
    {
        if (self::isSyntheticOAuthEmail($this->email)) {
            return null;
        }

        return $this->email;
    }

    /** @return list<string> */
    public function oauthProviderNames(): array
    {
        if ($this->relationLoaded('oauthAccounts')) {
            return $this->oauthAccounts->pluck('provider')->values()->all();
        }

        return $this->oauthAccounts()->pluck('provider')->all();
    }

    /** Lazily assigns a stable, unique referral code and returns it. */
    public function ensureReferralCode(): string
    {
        if ($this->referral_code) {
            return $this->referral_code;
        }

        do {
            $code = 'MDLZM-'.strtoupper(\Illuminate\Support\Str::random(6));
        } while (self::withTrashed()->where('referral_code', $code)->exists());

        $this->forceFill(['referral_code' => $code])->save();

        return $code;
    }

    public function isModerator(): bool
    {
        return in_array($this->role, [UserRole::Moderator, UserRole::Admin], true);
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }
}
