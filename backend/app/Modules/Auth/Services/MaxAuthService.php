<?php

namespace Modules\Auth\Services;

use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Support\PhoneNormalizer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Auth\Socialite\MaxSocialUser;

class MaxAuthService
{
    public const SESSION_TTL_SECONDS = 600;

    public function __construct(
        private readonly MaxBotClient $bot,
        private readonly OAuthService $oauth,
    ) {}

    public function isConfigured(): bool
    {
        return $this->bot->isConfigured();
    }

    /** @return array{session: string, bot_url: string, expires_in: int} */
    public function start(): array
    {
        $session = Str::lower(Str::random(22));

        Cache::put($this->sessionKey($session), [
            'status' => 'pending',
            'created_at' => now()->getTimestamp(),
            'return_url' => $this->siteUrl(),
        ], self::SESSION_TTL_SECONDS);

        return [
            'session' => $session,
            'bot_url' => $this->botUrl($session),
            'expires_in' => self::SESSION_TTL_SECONDS,
        ];
    }

    /** @return array{session: string, bot_url: string, expires_in: int} */
    public function startLink(User $user): array
    {
        $session = Str::lower(Str::random(22));

        Cache::put($this->sessionKey($session), [
            'status' => 'pending',
            'purpose' => 'link',
            'site_user_id' => $user->id,
            'created_at' => now()->getTimestamp(),
            'return_url' => $this->settingsUrl(),
        ], self::SESSION_TTL_SECONDS);

        return [
            'session' => $session,
            'bot_url' => $this->botUrl($session),
            'expires_in' => self::SESSION_TTL_SECONDS,
        ];
    }

    public function canUnlink(User $user): bool
    {
        if ($user->oauthAccounts()->where('provider', '!=', 'max')->exists()) {
            return true;
        }

        return filled($user->email) && ! User::isSyntheticOAuthEmail($user->email);
    }

    public function unlink(User $user): void
    {
        if (! $user->hasOAuthProvider('max')) {
            return;
        }

        if (! $this->canUnlink($user)) {
            abort(422, 'Сначала добавьте почту и пароль — иначе не войдёте на сайт.');
        }

        UserOAuthAccount::query()
            ->where('user_id', $user->id)
            ->where('provider', 'max')
            ->delete();

        app(MaxNotificationService::class)->disable($user);
    }

    /**
     * @return array{status: string, token?: string, message?: string}
     */
    public function status(string $session): array
    {
        $data = Cache::get($this->sessionKey($session));
        if (! is_array($data)) {
            return ['status' => 'expired'];
        }

        $status = (string) ($data['status'] ?? 'pending');
        $result = ['status' => $status];

        if ($status === 'conflict' && is_string($data['message'] ?? null) && $data['message'] !== '') {
            $result['message'] = $data['message'];
        }

        if ($status === 'ready' && is_string($data['token'] ?? null) && $data['token'] !== '') {
            $result['token'] = $data['token'];
            $data['token'] = null;
            $data['status'] = 'consumed';
            Cache::put($this->sessionKey($session), $data, self::SESSION_TTL_SECONDS);
        }

        return $result;
    }

    /** @param  array<string, mixed>  $payload */
    public function handleWebhook(array $payload): void
    {
        $updates = isset($payload['updates']) && is_array($payload['updates'])
            ? $payload['updates']
            : [$payload];

        foreach ($updates as $update) {
            if (! is_array($update)) {
                continue;
            }

            $this->handleUpdate($update);
        }
    }

    /** @param  array<string, mixed>  $update */
    public function handleUpdate(array $update): void
    {
        $type = (string) ($update['update_type'] ?? $update['updateType'] ?? '');

        match ($type) {
            'bot_started' => $this->onBotStarted($update),
            'message_callback' => $this->onCallback($update),
            'message_created' => $this->onMessage($update),
            default => null,
        };
    }

    public function webhookUrl(): string
    {
        $configured = trim((string) config('services.max.webhook_url'));
        if ($configured !== '') {
            return $configured;
        }

        return rtrim((string) config('app.url'), '/').'/api/v1/webhooks/max';
    }

    /** @param  array<string, mixed>  $update */
    private function onBotStarted(array $update): void
    {
        $session = $this->normalizeSession((string) ($update['payload'] ?? ''));
        $user = $this->extractUser($update);
        $userId = (string) ($user['user_id'] ?? '');

        if ($session === null) {
            $this->offerPhoneBind($userId);

            return;
        }

        $this->promptConfirm($session, $user);
    }

    /** @param  array<string, mixed>  $update */
    private function onCallback(array $update): void
    {
        $callback = is_array($update['callback'] ?? null) ? $update['callback'] : [];
        $callbackId = (string) ($callback['callback_id'] ?? '');
        $payload = (string) ($callback['payload'] ?? '');
        $user = $this->extractUser($callback) ?: $this->extractUser($update);

        if ($callbackId !== '' && ! Cache::add($this->callbackKey($callbackId), 1, 3600)) {
            $this->safeAnswer($callbackId, 'Уже обработано.');

            return;
        }

        if (! preg_match('/^(ok|no):([a-z0-9]{16,32})$/', $payload, $matches)) {
            $this->safeAnswer($callbackId, 'Неизвестная кнопка.');

            return;
        }

        $action = $matches[1];
        $session = $matches[2];
        $data = Cache::get($this->sessionKey($session));

        if (! is_array($data)) {
            $this->safeAnswer($callbackId, 'Сессия входа истекла. Вернитесь на сайт и нажмите MAX ещё раз.');

            return;
        }

        if ($action === 'no') {
            $data['status'] = 'denied';
            Cache::put($this->sessionKey($session), $data, self::SESSION_TTL_SECONDS);
            $isLink = $this->isLinkSession($data);
            $this->safeAnswer(
                $callbackId,
                $isLink ? 'Привязка отменена.' : 'Вход отменён.',
                $isLink
                    ? 'Привязка MAX отменена. Можно вернуться в настройки аккаунта.'
                    : 'Вход на modelizmclub.ru отменён. Можно вернуться на сайт и выбрать другой способ входа.',
                $isLink ? $this->settingsUrl() : $this->siteUrl(),
            );

            return;
        }

        if (in_array($data['status'] ?? '', ['ready', 'consumed'], true) && is_string($data['login_url'] ?? null)) {
            $isLink = $this->isLinkSession($data);
            $this->safeAnswer(
                $callbackId,
                $isLink ? 'Уже связано.' : 'Вы уже вошли.',
                $isLink ? 'MAX уже привязан к аккаунту.' : 'Вы уже вошли на modelizmclub.ru.',
                $data['login_url'],
            );

            return;
        }

        try {
            if ($this->isLinkSession($data)) {
                $this->completeLink($session, $user, null);
            } else {
                $this->completeLogin($session, $user, null, false);
            }
            $data = Cache::get($this->sessionKey($session));
            $loginUrl = is_array($data) ? ($data['login_url'] ?? null) : null;
            $isLink = is_array($data) && $this->isLinkSession($data);
            $this->safeAnswer(
                $callbackId,
                $isLink ? 'Аккаунт связан.' : 'Вход подтверждён.',
                $isLink
                    ? 'Аккаунт МоДелизМ связан. Уведомления будут приходить сюда. Вернитесь в настройки.'
                    : "Готово. Нажмите «Вернуться на сайт» — или откройте вкладку modelizmclub.ru, вход завершится сам.\nТелефон можно подтвердить по SMS на сайте.",
                is_string($loginUrl) ? $loginUrl : ($isLink ? $this->settingsUrl() : $this->siteUrl()),
            );
        } catch (\Throwable $e) {
            $fresh = Cache::get($this->sessionKey($session));
            if (is_array($fresh) && ($fresh['status'] ?? '') === 'conflict') {
                $this->safeAnswer(
                    $callbackId,
                    'Не удалось связать.',
                    (string) ($fresh['message'] ?? 'Этот MAX уже связан с другим аккаунтом.'),
                    $this->settingsUrl(),
                );

                return;
            }
            report($e);
            Log::warning('MAX login confirm failed', ['session' => $session, 'error' => $e->getMessage()]);
            $this->safeAnswer($callbackId, 'Не удалось войти. Попробуйте ещё раз с сайта.');
        }
    }

    /** @param  array<string, mixed>  $update */
    private function onMessage(array $update): void
    {
        $message = is_array($update['message'] ?? null) ? $update['message'] : [];
        $body = is_array($message['body'] ?? null) ? $message['body'] : [];
        $text = trim((string) ($body['text'] ?? $message['text'] ?? ''));
        $user = $this->extractUser($message['sender'] ?? []) ?: $this->extractUser($update);
        $userId = (string) ($user['user_id'] ?? '');

        $contact = $this->extractContact($message) ?? $this->extractContact($body) ?? $this->extractContact($update);
        if ($contact !== null && $userId !== '') {
            $this->onContactShared($user, $contact);

            return;
        }

        if (preg_match('/^\/start(?:\s+(.+))?$/u', $text, $matches)) {
            $session = $this->normalizeSession(trim((string) ($matches[1] ?? '')));
            if ($session !== null) {
                $this->promptConfirm($session, $user);
            } else {
                $this->offerPhoneBind($userId);
            }
        }
    }

    /** @param  array<string, mixed>  $user */
    private function promptConfirm(string $session, array $user): void
    {
        $userId = (string) ($user['user_id'] ?? '');
        $data = Cache::get($this->sessionKey($session));
        if (! is_array($data)) {
            if ($userId !== '') {
                $this->safeSend($userId, 'Сессия входа истекла. Вернитесь на modelizmclub.ru и нажмите MAX ещё раз.');
            }

            return;
        }

        if (in_array($data['status'] ?? '', ['ready', 'consumed'], true) && is_string($data['login_url'] ?? null)) {
            if ($userId !== '') {
                $done = $this->isLinkSession($data) ? 'MAX уже привязан. Откройте настройки:' : 'Вы уже подтвердили вход. Откройте сайт:';
                $this->safeSend($userId, $done, $data['login_url']);
            }

            return;
        }

        $data['status'] = 'awaiting_confirm';
        $data['user'] = $user;
        Cache::put($this->sessionKey($session), $data, self::SESSION_TTL_SECONDS);
        if ($userId !== '') {
            Cache::put($this->userSessionKey($userId), $session, self::SESSION_TTL_SECONDS);
        }

        $isLink = $this->isLinkSession($data);
        $returnUrl = $isLink ? $this->settingsUrl() : $this->siteUrl();
        $text = $isLink
            ? "Привязка MAX к аккаунту modelizmclub.ru\n\n1. Нажмите «Подтвердить привязку» — или поделитесь номером.\n2. Вернитесь во вкладку настроек — статус обновится сам."
            : "Вход на modelizmclub.ru\n\n1. Нажмите «Поделиться номером и войти» — или «Войти без номера».\n2. Нажмите «Вернуться на сайт». Вкладку modelizmclub.ru не закрывайте: вход завершится сам.";

        try {
            $this->bot->sendMessage([
                'text' => $text,
                'attachments' => [[
                    'type' => 'inline_keyboard',
                    'payload' => [
                        'buttons' => [
                            [[
                                'type' => 'request_contact',
                                'text' => $isLink ? 'Поделиться номером' : 'Поделиться номером и войти',
                            ]],
                            [
                                [
                                    'type' => 'callback',
                                    'text' => $isLink ? 'Подтвердить привязку' : 'Войти без номера',
                                    'payload' => 'ok:'.$session,
                                ],
                                [
                                    'type' => 'callback',
                                    'text' => 'Отмена',
                                    'payload' => 'no:'.$session,
                                    'intent' => 'negative',
                                ],
                            ],
                            [[
                                'type' => 'link',
                                'text' => $isLink ? 'Вернуться в настройки' : 'Вернуться на сайт',
                                'url' => $returnUrl,
                            ]],
                        ],
                    ],
                ]],
            ], ['user_id' => (int) $userId]);
        } catch (\Throwable $e) {
            Log::warning('MAX confirm prompt failed', ['error' => $e->getMessage()]);
        }
    }

    private function siteUrl(?string $token = null): string
    {
        $base = rtrim((string) config('app.frontend_url'), '/').'/login';
        if ($token === null || $token === '') {
            return $base;
        }

        return $base.'?'.http_build_query([
            'oauth_token' => $token,
            'oauth_provider' => 'max',
        ]);
    }

    private function frontendLoginUrl(string $token): string
    {
        return $this->siteUrl($token);
    }

    private function settingsUrl(): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/settings/account';
    }

    /** @param  array<string, mixed>  $data */
    private function isLinkSession(array $data): bool
    {
        return ($data['purpose'] ?? '') === 'link';
    }

    /** @param  array<string, mixed>  $user */
    private function completeLink(string $session, array $user, ?string $phone): void
    {
        $data = Cache::get($this->sessionKey($session));
        if (! is_array($data) || ! $this->isLinkSession($data)) {
            throw new \RuntimeException('Not a MAX link session.');
        }

        $siteUser = User::query()->find((int) ($data['site_user_id'] ?? 0));
        if ($siteUser === null) {
            throw new \RuntimeException('Site user is missing.');
        }

        $social = new MaxSocialUser($user);
        $maxId = $social->getId();
        if ($maxId === '') {
            throw new \RuntimeException('MAX user id is missing.');
        }

        $existing = UserOAuthAccount::query()
            ->where('provider', 'max')
            ->where('provider_user_id', $maxId)
            ->first();

        if ($existing !== null && (int) $existing->user_id !== (int) $siteUser->id) {
            $data['status'] = 'conflict';
            $data['message'] = 'Этот MAX уже связан с другим аккаунтом. Войдите в него или напишите в поддержку.';
            Cache::put($this->sessionKey($session), $data, self::SESSION_TTL_SECONDS);

            throw new \RuntimeException('MAX already linked to another account.');
        }

        UserOAuthAccount::query()
            ->where('user_id', $siteUser->id)
            ->where('provider', 'max')
            ->where('provider_user_id', '!=', $maxId)
            ->delete();

        UserOAuthAccount::query()->updateOrCreate(
            ['provider' => 'max', 'provider_user_id' => $maxId],
            ['user_id' => $siteUser->id, 'token' => []],
        );

        if ($phone !== null && ($siteUser->phone === null || $siteUser->phone === $phone)) {
            try {
                $siteUser->forceFill([
                    'phone' => $phone,
                    'phone_verified_at' => $siteUser->phone_verified_at ?? now(),
                ])->save();
            } catch (UniqueConstraintViolationException) {
                $siteUser->refresh();
            }
        }

        app(MaxNotificationService::class)->enable($siteUser);

        Cache::put($this->sessionKey($session), [
            'status' => 'ready',
            'purpose' => 'link',
            'site_user_id' => $siteUser->id,
            'login_url' => $this->settingsUrl(),
            'created_at' => $data['created_at'] ?? now()->getTimestamp(),
        ], self::SESSION_TTL_SECONDS);
    }

    /** @return array<int, array<int, array<string, mixed>>> */
    private function siteLinkButtons(?string $url = null): array
    {
        return [[
            [
                'type' => 'link',
                'text' => 'Вернуться на сайт',
                'url' => $url ?: $this->siteUrl(),
            ],
        ]];
    }

    private function botUrl(string $session): string
    {
        $username = ltrim((string) config('services.max.bot_username'), '@');

        return 'https://max.ru/'.$username.'?start='.$session;
    }

    private function normalizeSession(string $payload): ?string
    {
        $payload = trim($payload);
        if ($payload === '') {
            return null;
        }

        if (preg_match('/^[a-z0-9]{16,32}$/', $payload) === 1) {
            return $payload;
        }

        return null;
    }

    /** @param  array<string, mixed>  $source */
    private function extractUser(array $source): array
    {
        if (isset($source['user']) && is_array($source['user'])) {
            return $source['user'];
        }

        if (isset($source['user_id'])) {
            return $source;
        }

        return [];
    }

    private function safeSend(string $userId, string $text, ?string $loginUrl = null): void
    {
        try {
            $this->bot->sendMessage([
                'text' => $text,
                'attachments' => [[
                    'type' => 'inline_keyboard',
                    'payload' => [
                        'buttons' => $this->siteLinkButtons($loginUrl),
                    ],
                ]],
            ], ['user_id' => (int) $userId]);
        } catch (\Throwable $e) {
            Log::warning('MAX sendMessage failed', ['error' => $e->getMessage()]);
        }
    }

    private function safeAnswer(string $callbackId, string $notification, ?string $text = null, ?string $loginUrl = null): void
    {
        if ($callbackId === '') {
            return;
        }

        try {
            $body = ['notification' => $notification];
            if ($text !== null) {
                $message = ['text' => $text];
                $message['attachments'] = [[
                    'type' => 'inline_keyboard',
                    'payload' => [
                        'buttons' => $this->siteLinkButtons($loginUrl),
                    ],
                ]];
                $body['message'] = $message;
            }
            $this->bot->answerCallback($callbackId, $body);
        } catch (\Throwable $e) {
            Log::warning('MAX answerCallback failed', ['error' => $e->getMessage()]);
        }
    }

    private function sessionKey(string $session): string
    {
        return 'max_auth:'.$session;
    }

    private function userSessionKey(string $userId): string
    {
        return 'max_auth_uid:'.$userId;
    }

    /**
     * @param  array<string, mixed>  $user
     * @param  array<string, mixed>  $contact
     */
    private function onContactShared(array $user, array $contact): void
    {
        $userId = (string) ($user['user_id'] ?? '');
        $vcf = (string) ($contact['vcf_info'] ?? '');
        $hash = (string) ($contact['hash'] ?? '');
        $phone = $this->phoneFromContact($contact);
        $isRequestContact = trim($hash) !== '';
        $hashValid = $isRequestContact && $vcf !== '' && $this->contactHashValid($vcf, $hash);

        if (! $isRequestContact) {
            if ($userId !== '') {
                $this->safeSend(
                    $userId,
                    'Нажмите «Поделиться номером и войти» под сообщением бота — так MAX подтвердит номер. Либо «Войти без номера» и «Вернуться на сайт».',
                    $this->sessionReturnUrl($userId),
                );
            }

            return;
        }

        if (! $hashValid) {
            Log::warning('MAX contact HMAC mismatch; accepting request_contact from signed webhook', [
                'user_id' => $userId,
                'hash_len' => strlen($hash),
                'hash_hex' => ctype_xdigit($hash),
                'vcf_len' => strlen($vcf),
                'vcf_cr' => str_contains($vcf, "\r"),
                'vcf_lf' => str_contains($vcf, "\n"),
                'contact_keys' => array_keys($contact),
                'hmac_prefix' => substr(hash_hmac('sha256', $vcf, (string) config('services.max.bot_token')), 0, 8),
                'hash_prefix' => substr($hash, 0, 8),
                'vcf_redacted' => preg_replace('/(?<=:)[+0-9]{10,15}/', '7XXXXXXXXXX', $vcf),
            ]);
        }

        if ($phone === null) {
            if ($userId !== '') {
                $this->safeSend($userId, 'Не удалось прочитать номер. Нажмите «Войти без номера», затем «Вернуться на сайт».', $this->sessionReturnUrl($userId));
            }

            return;
        }

        $session = $userId !== '' ? Cache::get($this->userSessionKey($userId)) : null;
        if (is_string($session) && $this->normalizeSession($session) !== null) {
            $data = Cache::get($this->sessionKey($session));
            if (is_array($data) && ! in_array($data['status'] ?? '', ['ready', 'consumed', 'denied'], true)) {
                $merged = array_merge(is_array($data['user'] ?? null) ? $data['user'] : [], $user, ['phone' => $phone]);
                try {
                    if ($this->isLinkSession($data)) {
                        $this->completeLink($session, $merged, $phone);
                    } else {
                        $this->completeLogin($session, $merged, $phone, true);
                    }
                } catch (\Throwable $e) {
                    $fresh = Cache::get($this->sessionKey($session));
                    if (is_array($fresh) && ($fresh['status'] ?? '') === 'conflict') {
                        $this->safeSend($userId, (string) ($fresh['message'] ?? 'Этот MAX уже связан с другим аккаунтом.'), $this->settingsUrl());

                        return;
                    }
                    report($e);
                    Log::warning('MAX contact login failed', ['session' => $session, 'error' => $e->getMessage()]);
                    $this->safeSend($userId, 'Не удалось войти. Попробуйте ещё раз с сайта.');

                    return;
                }
                $fresh = Cache::get($this->sessionKey($session));
                $loginUrl = is_array($fresh) && is_string($fresh['login_url'] ?? null) ? $fresh['login_url'] : null;
                $note = is_array($fresh) && is_string($fresh['note'] ?? null) ? $fresh['note'].' ' : 'Номер сохранён. ';
                $hint = is_array($fresh) && $this->isLinkSession($fresh)
                    ? 'Вернитесь в настройки.'
                    : 'Нажмите «Вернуться на сайт».';
                $this->safeSend($userId, $note.$hint, $loginUrl);

                return;
            }
        }

        $this->attachPhoneToExistingMaxUser($userId, $phone);
    }

    private function attachPhoneToExistingMaxUser(string $maxUserId, string $phone): void
    {
        $account = UserOAuthAccount::query()
            ->where('provider', 'max')
            ->where('provider_user_id', $maxUserId)
            ->first();

        if ($account === null) {
            $this->safeSend($maxUserId, 'Чтобы войти на modelizmclub.ru, нажмите кнопку MAX на сайте.');

            return;
        }

        $owner = User::query()->where('phone', $phone)->where('id', '!=', $account->user_id)->first();
        if ($owner !== null) {
            $from = $account->user;
            if ($from !== null) {
                $this->relinkMaxAccount($maxUserId, $from, $owner);
            }
            $token = $owner->createToken('api')->plainTextToken;
            $this->safeSend(
                $maxUserId,
                'Вошли в аккаунт, где уже есть этот номер. Нажмите «Вернуться на сайт».',
                $this->siteUrl($token),
            );

            return;
        }

        $siteUser = $account->user;
        if ($siteUser === null) {
            return;
        }

        try {
            $siteUser->forceFill([
                'phone' => $phone,
                'phone_verified_at' => $siteUser->phone_verified_at ?? now(),
            ])->save();
        } catch (UniqueConstraintViolationException) {
            $siteUser->refresh();
        }

        $token = $siteUser->createToken('api')->plainTextToken;
        $this->safeSend(
            $maxUserId,
            'Номер сохранён. Нажмите «Вернуться на сайт» — вход завершится сам.',
            $this->siteUrl($token),
        );
    }

    /** @param  array<string, mixed>  $user */
    private function completeLogin(string $session, array $user, ?string $phone, bool $phoneVerified): void
    {
        if ($phone !== null) {
            $user['phone'] = $phone;
        }

        $social = new MaxSocialUser($user);
        if ($social->getId() === '') {
            throw new \RuntimeException('MAX user id is missing.');
        }

        $result = $this->oauth->resolveUser('max', $social);
        $siteUser = $result['user']->fresh();
        $note = null;

        if ($phone !== null && $siteUser !== null) {
            $owner = User::query()
                ->where('phone', $phone)
                ->where('id', '!=', $siteUser->id)
                ->first();

            if ($owner !== null) {
                $this->relinkMaxAccount($social->getId(), $siteUser, $owner);
                $result = [
                    'user' => $owner->fresh(),
                    'token' => $owner->createToken('api')->plainTextToken,
                ];
                $note = 'Вошли в аккаунт, где уже есть этот номер.';
            } elseif ($siteUser->phone === null || $siteUser->phone === $phone) {
                try {
                    $siteUser->forceFill([
                        'phone' => $phone,
                        'phone_verified_at' => $phoneVerified ? ($siteUser->phone_verified_at ?? now()) : $siteUser->phone_verified_at,
                    ])->save();
                } catch (UniqueConstraintViolationException) {
                    $siteUser->refresh();
                }
            }
        }

        $loginUrl = $this->frontendLoginUrl($result['token']);
        $data = Cache::get($this->sessionKey($session));
        Cache::put($this->sessionKey($session), [
            'status' => 'ready',
            'token' => $result['token'],
            'login_url' => $loginUrl,
            'user' => $user,
            'note' => $note,
            'created_at' => is_array($data) ? ($data['created_at'] ?? now()->getTimestamp()) : now()->getTimestamp(),
        ], self::SESSION_TTL_SECONDS);
    }

    private function relinkMaxAccount(string $maxUserId, User $from, User $to): void
    {
        $stub = $this->isDisposableMaxStub($from);

        UserOAuthAccount::query()
            ->where('provider', 'max')
            ->where('provider_user_id', $maxUserId)
            ->update(['user_id' => $to->id]);

        if ($stub && $from->id !== $to->id) {
            $from->tokens()->delete();
            $from->delete();
        }
    }

    private function isDisposableMaxStub(User $user): bool
    {
        if (! User::isSyntheticOAuthEmail($user->email) || filled($user->phone)) {
            return false;
        }

        $providers = $user->oauthAccounts()->pluck('provider')->unique()->values();

        return $providers->count() === 1 && $providers->first() === 'max';
    }

    private function offerPhoneBind(string $userId): void
    {
        if ($userId === '') {
            return;
        }

        $account = UserOAuthAccount::query()
            ->where('provider', 'max')
            ->where('provider_user_id', $userId)
            ->first();

        if ($account === null) {
            $this->safeSend($userId, 'Чтобы войти на modelizmclub.ru, нажмите кнопку MAX на сайте.');

            return;
        }

        $siteUser = $account->user;
        if ($siteUser !== null && filled($siteUser->phone) && $siteUser->phone_verified_at !== null) {
            $this->safeSend($userId, 'Аккаунт уже связан. Откройте modelizmclub.ru — вы можете войти кнопкой MAX на сайте.');

            return;
        }

        try {
            $this->bot->sendMessage([
                'text' => 'Отправьте номер из MAX, чтобы подставить его в профиль. Затем нажмите «Вернуться на сайт».',
                'attachments' => [[
                    'type' => 'inline_keyboard',
                    'payload' => [
                        'buttons' => [
                            [['type' => 'request_contact', 'text' => 'Поделиться номером']],
                            [['type' => 'link', 'text' => 'Вернуться на сайт', 'url' => $this->siteUrl()]],
                        ],
                    ],
                ]],
            ], ['user_id' => (int) $userId]);
        } catch (\Throwable $e) {
            Log::warning('MAX phone bind prompt failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @param  array<string, mixed>  $source
     * @return array<string, mixed>|null
     */
    private function extractContact(array $source): ?array
    {
        $attachments = $source['attachments'] ?? null;
        if (! is_array($attachments)) {
            return null;
        }

        foreach ($attachments as $attachment) {
            if (! is_array($attachment)) {
                continue;
            }
            $type = (string) ($attachment['type'] ?? '');
            if ($type !== 'contact') {
                continue;
            }
            $payload = $attachment['payload'] ?? $attachment;
            if (is_array($payload)) {
                return $payload;
            }
        }

        return null;
    }

    /** @param  array<string, mixed>  $contact */
    private function phoneFromContact(array $contact): ?string
    {
        $candidates = [
            $contact['phone'] ?? null,
            $contact['phone_number'] ?? null,
            $contact['vcf_phone'] ?? null,
            data_get($contact, 'max_info.phone'),
            data_get($contact, 'max_info.phone_number'),
        ];
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                $normalized = PhoneNormalizer::normalize($candidate);
                if ($normalized !== null) {
                    return $normalized;
                }
            }
        }

        $vcf = (string) ($contact['vcf_info'] ?? '');
        if (preg_match('/TEL[^:]*:([+\d\s\-()]+)/i', $vcf, $matches) === 1) {
            return PhoneNormalizer::normalize($matches[1]);
        }

        return null;
    }

    private function sessionReturnUrl(string $userId): string
    {
        $session = Cache::get($this->userSessionKey($userId));
        if (is_string($session)) {
            $data = Cache::get($this->sessionKey($session));
            if (is_array($data) && is_string($data['login_url'] ?? null) && $data['login_url'] !== '') {
                return $data['login_url'];
            }
        }

        return $this->siteUrl();
    }

    private function contactHashValid(string $vcfInfo, string $hash): bool
    {
        $token = trim((string) config('services.max.bot_token'));
        $hash = trim($hash);
        if ($token === '' || $hash === '') {
            return false;
        }

        $escapedToReal = str_replace(['\\r\\n', '\\n'], ["\r\n", "\n"], $vcfInfo);
        $realToEscaped = str_replace(["\r\n", "\n"], '\\r\\n', $vcfInfo);
        $lf = str_replace("\r\n", "\n", $vcfInfo);
        $crlf = str_replace("\n", "\r\n", str_replace("\r\n", "\n", $vcfInfo));
        $variants = array_values(array_unique([
            $vcfInfo,
            $escapedToReal,
            $realToEscaped,
            $lf,
            $crlf,
            trim($vcfInfo),
        ]));

        foreach ($variants as $vcf) {
            $raw = hash_hmac('sha256', $vcf, $token, true);
            $candidates = [
                hash_hmac('sha256', $vcf, $token),
                strtoupper(hash_hmac('sha256', $vcf, $token)),
                base64_encode($raw),
                rtrim(strtr(base64_encode($raw), '+/', '-_'), '='),
                hash_hmac('sha256', $token, $vcf),
            ];
            foreach ($candidates as $value) {
                if (hash_equals($value, $hash)) {
                    return true;
                }
                if (
                    ctype_xdigit($value)
                    && ctype_xdigit($hash)
                    && strlen($value) === strlen($hash)
                    && hash_equals(strtolower($value), strtolower($hash))
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private function callbackKey(string $callbackId): string
    {
        return 'max_cb:'.hash('sha256', $callbackId);
    }
}
