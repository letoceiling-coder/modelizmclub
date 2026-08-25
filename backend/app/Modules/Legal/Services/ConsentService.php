<?php

namespace Modules\Legal\Services;

use App\Enums\ConsentStatus;
use App\Enums\ConsentType;
use App\Models\ConsentLog;
use App\Models\LegalPage;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ConsentService
{
    /** @return array<string, string> slug => doc_version key */
    public function publishedDocVersions(): array
    {
        return LegalPage::query()
            ->where('status', 'published')
            ->get(['slug', 'version'])
            ->mapWithKeys(fn (LegalPage $p) => [$p->slug => $p->docVersionKey()])
            ->all();
    }

    public function docVersionForSlug(string $slug): string
    {
        $page = LegalPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->first();

        return $page?->docVersionKey() ?? $slug.'-v1';
    }

    public function log(
        ?User $user,
        ConsentType $type,
        string $docVersion,
        ConsentStatus $status,
        ?Request $request = null,
    ): ConsentLog {
        return ConsentLog::create([
            'user_id' => $user?->id,
            'consent_type' => $type,
            'doc_version' => $docVersion,
            'status' => $status,
            'ip' => $request?->ip(),
            'user_agent' => $request ? (string) $request->userAgent() : null,
            'created_at' => now(),
        ]);
    }

    /** @param  array{terms: bool, privacy: bool, ads: bool}  $acceptances */
    public function recordRegistrationConsents(User $user, array $acceptances, Request $request): void
    {
        if ($acceptances['terms']) {
            $this->log($user, ConsentType::Terms, $this->docVersionForSlug('rules'), ConsentStatus::Granted, $request);
        }

        if ($acceptances['privacy']) {
            $this->log($user, ConsentType::Privacy, $this->docVersionForSlug('privacy'), ConsentStatus::Granted, $request);
        }

        $this->log(
            $user,
            ConsentType::Ads,
            $this->docVersionForSlug('privacy'),
            $acceptances['ads'] ? ConsentStatus::Granted : ConsentStatus::Revoked,
            $request,
        );
    }

    /** @return list<array<string, mixed>> */
    public function listForUser(User $user): array
    {
        $latest = ConsentLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get()
            ->unique(fn (ConsentLog $log) => $log->consent_type->value);

        return $latest->map(fn (ConsentLog $log) => [
            'type' => $log->consent_type->value,
            'doc_version' => $log->doc_version,
            'status' => $log->status->value,
            'created_at' => $log->created_at?->toIso8601String(),
        ])->values()->all();
    }

    public function revoke(User $user, ConsentType $type, Request $request): ConsentLog
    {
        if (in_array($type, [ConsentType::Terms, ConsentType::Privacy], true)) {
            throw ValidationException::withMessages([
                'type' => ['Согласие на условия и обработку ПД нельзя отозвать без удаления аккаунта.'],
            ]);
        }

        $slug = match ($type) {
            ConsentType::Ads => 'privacy',
            ConsentType::Cookies => 'privacy',
            default => 'privacy',
        };

        $log = $this->log($user, $type, $this->docVersionForSlug($slug), ConsentStatus::Revoked, $request);

        if ($type === ConsentType::Ads) {
            NotificationPreference::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'channel' => 'in_app',
                    'type' => 'promo',
                ],
                ['enabled' => false],
            );
        }

        return $log;
    }
}
