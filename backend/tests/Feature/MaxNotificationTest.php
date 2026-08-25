<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Modules\Auth\Notifications\VerificationCodeNotification;
use Tests\TestCase;

class MaxNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        config([
            'services.max.bot_token' => 'test-bot-token',
            'services.max.bot_username' => 'id2312341754_bot',
            'services.max.api_base' => 'https://platform-api2.max.ru',
            'app.frontend_url' => 'https://modelizmclub.ru',
        ]);

        Http::fake([
            'https://platform-api2.max.ru/*' => Http::response(['success' => true], 200),
        ]);
    }

    public function test_in_app_notification_is_sent_to_linked_max_account(): void
    {
        $user = $this->userWithMax('9001');

        InAppNotify::send(
            $user,
            new InAppNotification('friend_request', 'Новая заявка в друзья', 'Иван хочет добавить вас', '/friends'),
        );

        Http::assertSent(fn ($request): bool => $this->isMaxMessage($request, '9001', 'Новая заявка в друзья')
            && str_contains((string) $request->body(), 'Иван хочет добавить вас')
            && str_contains((string) $request->body(), 'https://modelizmclub.ru/friends'));
    }

    public function test_user_without_max_does_not_trigger_max_send(): void
    {
        $user = User::factory()->create();

        InAppNotify::send($user, new InAppNotification('system', 'Система', 'Тело', '/feed'));

        Http::assertNothingSent();
    }

    public function test_mail_notification_is_mirrored_to_max(): void
    {
        $user = $this->userWithMax('77');

        $user->notify(new VerificationCodeNotification('654321'));

        Http::assertSent(fn ($request): bool => $this->isMaxMessage($request, '77', '654321')
            && str_contains((string) $request->body(), 'Код подтверждения'));
    }

    public function test_password_reset_is_sent_to_max_with_link(): void
    {
        $user = $this->userWithMax('55');

        $user->sendPasswordResetNotification('reset-token-abc');

        Http::assertSent(function ($request) use ($user): bool {
            if (! $this->isMaxMessage($request, '55', 'Сброс пароля')) {
                return false;
            }
            $body = (string) $request->body();

            return str_contains($body, 'reset-password')
                && str_contains($body, urlencode($user->email));
        });
    }

    public function test_unconfigured_bot_does_not_send(): void
    {
        config(['services.max.bot_token' => '']);
        $user = $this->userWithMax('12');

        InAppNotify::send($user, new InAppNotification('system', 'Hi', 'Body'));

        Http::assertNothingSent();
    }

    private function userWithMax(string $maxUserId): User
    {
        $user = User::factory()->create();
        UserOAuthAccount::query()->create([
            'user_id' => $user->id,
            'provider' => 'max',
            'provider_user_id' => $maxUserId,
            'token' => [],
        ]);

        return $user;
    }

    private function isMaxMessage(object $request, string $maxUserId, string $needle): bool
    {
        $url = $request->url();

        return str_contains($url, 'platform-api2.max.ru/messages')
            && str_contains($url, 'user_id='.$maxUserId)
            && str_contains((string) $request->body(), $needle);
    }
}
