<?php

namespace Modules\Legal\Services;

use App\Models\ConsentLog;
use App\Models\User;

class UserDataExportService
{
    /** @return array<string, mixed> */
    public function export(User $user): array
    {
        $user->loadMissing(['profile', 'oauthAccounts']);

        return [
            'exported_at' => now()->toIso8601String(),
            'user' => [
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->displayEmail(),
                'phone' => $user->phone,
                'role' => $user->role?->value,
                'status' => $user->status?->value,
                'registration_track' => $user->registration_track?->value,
                'locale' => $user->locale,
                'referral_code' => $user->referral_code,
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                'phone_verified_at' => $user->phone_verified_at?->toIso8601String(),
                'created_at' => $user->created_at?->toIso8601String(),
            ],
            'profile' => $user->profile?->toArray(),
            'oauth_providers' => $user->oauthProviderNames(),
            'consents' => ConsentLog::query()
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->get(['consent_type', 'doc_version', 'status', 'created_at'])
                ->map(fn (ConsentLog $log) => [
                    'type' => $log->consent_type->value,
                    'doc_version' => $log->doc_version,
                    'status' => $log->status->value,
                    'created_at' => $log->created_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }
}
