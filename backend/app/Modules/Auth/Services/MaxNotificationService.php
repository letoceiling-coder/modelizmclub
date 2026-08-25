<?php

namespace Modules\Auth\Services;

use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Models\NotificationPreference;
use App\Notifications\InAppNotification;
use App\Services\NotificationPolicy;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Mirrors every Laravel notification to MAX for users who logged in via MAX
 * or linked a MAX account (user_oauth_accounts.provider = max).
 */
class MaxNotificationService
{
    public const CHANNEL = 'max';

    public const MASTER_TYPE = 'all';

    private const TEXT_LIMIT = 3900;

    public function __construct(
        private readonly MaxBotClient $bot,
    ) {}

    public function mirror(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User || ! $this->bot->isConfigured()) {
            return;
        }

        $maxUserId = $this->maxUserId($notifiable);
        if ($maxUserId === null || ! $this->isEnabled($notifiable) || ! $this->allowsNotification($notifiable, $notification)) {
            return;
        }

        $dedupeKey = 'max_notify:'.$notifiable->id.':'.spl_object_id($notification);
        if (! Cache::add($dedupeKey, 1, 120)) {
            return;
        }

        [$text, $url] = $this->format($notifiable, $notification);
        if ($text === '') {
            return;
        }

        $this->sendSafely((int) $maxUserId, $text, $url);
    }

    public function enable(User $user): void
    {
        NotificationPreference::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'channel' => self::CHANNEL,
                'type' => self::MASTER_TYPE,
            ],
            ['enabled' => true],
        );
    }

    public function enableIfMissing(User $user): void
    {
        NotificationPreference::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'channel' => self::CHANNEL,
                'type' => self::MASTER_TYPE,
            ],
            ['enabled' => true],
        );
    }

    public function disable(User $user): void
    {
        NotificationPreference::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'channel' => self::CHANNEL,
                'type' => self::MASTER_TYPE,
            ],
            ['enabled' => false],
        );
    }

    public function isEnabled(User $user): bool
    {
        $row = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('channel', self::CHANNEL)
            ->where('type', self::MASTER_TYPE)
            ->first();

        return $row === null || $row->enabled;
    }

    private function allowsNotification(User $user, Notification $notification): bool
    {
        if (! $notification instanceof InAppNotification) {
            return true;
        }

        return NotificationPolicy::allows($user, $notification->type, self::CHANNEL);
    }

    private function maxUserId(User $user): ?string
    {
        if ($user->relationLoaded('oauthAccounts')) {
            $id = $user->oauthAccounts
                ->first(fn (UserOAuthAccount $account): bool => $account->provider === 'max')
                ?->provider_user_id;
        } else {
            $id = UserOAuthAccount::query()
                ->where('user_id', $user->id)
                ->where('provider', 'max')
                ->value('provider_user_id');
        }

        if (! is_string($id) && ! is_int($id)) {
            return null;
        }

        $id = trim((string) $id);

        return $id !== '' && ctype_digit($id) ? $id : null;
    }

    /** @return array{0: string, 1: ?string} */
    private function format(User $user, Notification $notification): array
    {
        if ($notification instanceof InAppNotification) {
            $text = $this->joinLines([$notification->title, $notification->body]);

            return [$text, $this->absoluteUrl($notification->link)];
        }

        if (method_exists($notification, 'toMail')) {
            try {
                $mail = $notification->toMail($user);
            } catch (Throwable $e) {
                Log::warning('MAX notification: toMail failed', [
                    'notification' => $notification::class,
                    'error' => $e->getMessage(),
                ]);
                $mail = null;
            }

            if ($mail instanceof MailMessage) {
                $lines = array_filter([
                    $mail->subject,
                    $mail->greeting,
                    ...$mail->introLines,
                    ...$mail->outroLines,
                ], fn ($line): bool => is_string($line) && trim($this->plain((string) $line)) !== '');

                $text = $this->joinLines(array_map(fn (string $line): string => $this->plain($line), $lines));
                $url = is_string($mail->actionUrl) && $mail->actionUrl !== '' ? $mail->actionUrl : null;

                return [$text, $url];
            }
        }

        return ['Новое уведомление на modelizmclub.ru', rtrim((string) config('app.frontend_url'), '/')];
    }

    private function sendSafely(int $maxUserId, string $text, ?string $url): void
    {
        $text = mb_substr($text, 0, self::TEXT_LIMIT);
        $body = ['text' => $text];
        if ($url !== null && $url !== '') {
            $body['attachments'] = [[
                'type' => 'inline_keyboard',
                'payload' => [
                    'buttons' => [[
                        [
                            'type' => 'link',
                            'text' => 'Открыть',
                            'url' => $url,
                        ],
                    ]],
                ],
            ]];
        }

        try {
            $this->bot->sendMessage($body, ['user_id' => $maxUserId]);
        } catch (Throwable $e) {
            Log::warning('MAX notification send failed', [
                'max_user_id' => $maxUserId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** @param  list<string>  $parts */
    private function joinLines(array $parts): string
    {
        $chunks = [];
        foreach ($parts as $part) {
            $trimmed = trim($part);
            if ($trimmed !== '') {
                $chunks[] = $trimmed;
            }
        }

        return implode("\n\n", $chunks);
    }

    private function plain(string $value): string
    {
        $value = preg_replace('/\*\*(.+?)\*\*/u', '$1', $value) ?? $value;

        return html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function absoluteUrl(?string $link): ?string
    {
        if ($link === null || trim($link) === '') {
            return null;
        }

        $link = trim($link);
        if (str_starts_with($link, 'http://') || str_starts_with($link, 'https://')) {
            return $link;
        }

        $base = rtrim((string) config('app.frontend_url'), '/');

        return $base.'/'.ltrim($link, '/');
    }
}
