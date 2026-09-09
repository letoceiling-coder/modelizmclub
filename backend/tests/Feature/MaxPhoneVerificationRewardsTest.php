<?php

namespace Tests\Feature;

use App\Enums\ReferralStatus;
use App\Enums\UserStatus;
use App\Models\Referral;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserOAuthAccount;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Подтверждение телефона через MAX — те же начисления, что и по СМС.
 *
 * MAX отдаёт номер вместе с согласием пользователя, и приложение проставляло
 * `phone_verified_at` напрямую, минуя `PhoneVerificationService`. Тот при
 * первом подтверждении закрывает приглашение друга и выдаёт промо «первой
 * сотни»; здесь не выдавалось ничего, и приглашение оставалось в `pending`
 * навсегда.
 *
 * Отличить это по базе нельзя: строка выглядит ровно так же, как у друга,
 * который просто не дошёл до подтверждения. Поэтому проверка, а не осмотр.
 */
class MaxPhoneVerificationRewardsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        config([
            'services.max.bot_token' => 'test-bot-token',
            'services.max.bot_username' => 'test_bot',
            'services.max.api_base' => 'https://platform-api2.max.ru',
            'services.max.webhook_secret' => 'TestSecret-123',
            'app.frontend_url' => 'https://modelizmclub.ru',
        ]);

        Http::fake([
            'https://platform-api2.max.ru/*' => Http::response(['success' => true], 200),
        ]);

        SystemSetting::query()->updateOrCreate(
            ['key' => 'referral_program'],
            ['value' => ['enabled' => true, 'per_invite' => 1, 'max_bonus' => 10], 'group' => 'marketing'],
        );
    }

    private function referrer(): User
    {
        $user = User::factory()->create([
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
        ]);
        UserProfile::query()->create([
            'user_id' => $user->id,
            'display_name' => 'Пригласивший',
            'slug' => 'inviter-'.uniqid(),
        ]);
        $user->ensureReferralCode();

        return $user->fresh();
    }

    public function test_подтверждение_телефона_через_max_засчитывает_приглашение(): void
    {
        $referrer = $this->referrer();

        $invitee = User::factory()->create([
            'email' => 'max_91@oauth.modelizmclub.local',
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
            'referred_by' => $referrer->id,
        ]);
        UserOAuthAccount::query()->create([
            'user_id' => $invitee->id,
            'provider' => 'max',
            'provider_user_id' => '91',
            'token' => [],
        ]);
        Referral::query()->create([
            'inviter_id' => $referrer->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Pending,
        ]);

        $this->assertSame(0, (int) $referrer->listing_placement_credits);

        $vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nTEL;TYPE=cell:79001112255\r\nEND:VCARD\r\n";

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', [
                'update_type' => 'message_created',
                'message' => [
                    'sender' => ['user_id' => 91, 'first_name' => 'Друг'],
                    'body' => [
                        'attachments' => [[
                            'type' => 'contact',
                            'payload' => [
                                'vcf_info' => $vcf,
                                'hash' => hash_hmac('sha256', $vcf, 'test-bot-token'),
                            ],
                        ]],
                    ],
                ],
            ])
            ->assertOk();

        $invitee->refresh();
        $this->assertNotNull($invitee->phone_verified_at, 'MAX должен был подтвердить телефон');

        $referrer->refresh();
        $this->assertSame(1, (int) $referrer->listing_placement_credits);
        $this->assertSame(
            ReferralStatus::Completed,
            Referral::query()->where('invitee_id', $invitee->id)->firstOrFail()->status,
        );
    }

    /**
     * Повторный контакт из MAX ничего не добавляет.
     *
     * Бот присылает контакт при каждом входе, и начисление за одно
     * приглашение должно случиться один раз. `onPhoneVerified` идемпотентен
     * по статусу строки, но проверка нужна: без неё регресс выглядел бы как
     * щедрость, а не как ошибка.
     */
    public function test_повторное_подтверждение_не_начисляет_второй_раз(): void
    {
        $referrer = $this->referrer();

        $invitee = User::factory()->create([
            'email' => 'max_92@oauth.modelizmclub.local',
            'phone' => null,
            'phone_verified_at' => null,
            'email_verified_at' => now(),
            'referred_by' => $referrer->id,
        ]);
        UserOAuthAccount::query()->create([
            'user_id' => $invitee->id,
            'provider' => 'max',
            'provider_user_id' => '92',
            'token' => [],
        ]);
        Referral::query()->create([
            'inviter_id' => $referrer->id,
            'invitee_id' => $invitee->id,
            'status' => ReferralStatus::Pending,
        ]);

        $vcf = "BEGIN:VCARD\r\nVERSION:3.0\r\nTEL;TYPE=cell:79001112266\r\nEND:VCARD\r\n";
        $payload = [
            'update_type' => 'message_created',
            'message' => [
                'sender' => ['user_id' => 92, 'first_name' => 'Друг'],
                'body' => [
                    'attachments' => [[
                        'type' => 'contact',
                        'payload' => [
                            'vcf_info' => $vcf,
                            'hash' => hash_hmac('sha256', $vcf, 'test-bot-token'),
                        ],
                    ]],
                ],
            ],
        ];

        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', $payload)->assertOk();
        $this->withHeader('X-Max-Bot-Api-Secret', 'TestSecret-123')
            ->postJson('/api/v1/webhooks/max', $payload)->assertOk();

        $this->assertSame(1, (int) $referrer->fresh()->listing_placement_credits);
    }
}
