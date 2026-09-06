<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Services\SafeDealSettlementService;
use Modules\Billing\Support\SafeDealEscrowConfig;
use Tests\TestCase;

/**
 * Провайдер безопасной сделки переключается из админки, а не правкой .env.
 *
 * Проверяется следствие — что вернёт SafeDealSettlementService::provider(),
 * то есть куда на самом деле пойдут деньги, — а не код ответа эндпоинта.
 * Отдельно закреплена обратимость: после возврата на «vtb» сделки снова
 * идут через банк, без остаточного состояния.
 */
class SafeDealEscrowProviderSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        // Окружение говорит «банк», и банк настроен: в этих условиях
        // настройка из админки должна суметь увести сделки на кошелёк.
        config([
            'billing.safe_deal.escrow_provider' => 'vtb',
            'billing.vtb.enabled' => true,
            'billing.vtb.api_url' => 'https://vtb.test/payment/rest/',
            'billing.vtb.username' => 'merchant',
            'billing.vtb.password' => 'secret',
            'billing.vtb.token' => null,
        ]);
    }

    private function provider(): string
    {
        return app(SafeDealSettlementService::class)->provider();
    }

    private function saveProvider(string $value): \Illuminate\Testing\TestResponse
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        return $this->patchJson('/api/v1/admin/settings', [
            'settings' => [[
                'key' => SafeDealEscrowConfig::SETTING_KEY,
                'group' => SafeDealEscrowConfig::GROUP,
                'value' => ['provider' => $value],
            ]],
        ], ['Authorization' => "Bearer {$token}"]);
    }

    public function test_without_setting_environment_still_decides(): void
    {
        $this->assertSame('vtb', $this->provider());
    }

    public function test_admin_setting_switches_deals_to_wallet(): void
    {
        $this->saveProvider('wallet')->assertOk();

        $this->assertSame('wallet', $this->provider());
        $this->assertDatabaseHas('system_settings', ['key' => SafeDealEscrowConfig::SETTING_KEY]);
    }

    public function test_switch_back_to_vtb_is_reversible(): void
    {
        $this->saveProvider('wallet')->assertOk();
        $this->assertSame('wallet', $this->provider());

        $this->saveProvider('vtb')->assertOk();

        $this->assertSame('vtb', $this->provider());
    }

    public function test_unknown_provider_is_rejected_and_previous_value_survives(): void
    {
        $this->saveProvider('wallet')->assertOk();

        $this->saveProvider('paypal')->assertStatus(422);

        $this->assertSame('wallet', $this->provider(), 'отклонённое сохранение не должно менять провайдера');
    }

    public function test_choosing_vtb_without_acquiring_falls_back_and_admin_sees_it(): void
    {
        config(['billing.vtb.enabled' => false]);
        $this->saveProvider('vtb')->assertOk();

        // Сохранено «vtb», но эквайринга нет — деньги пойдут на кошелёк.
        $this->assertSame('wallet', $this->provider());

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $row = collect($this->getJson('/api/v1/admin/settings', ['Authorization' => "Bearer {$token}"])
            ->assertOk()->json('data'))
            ->firstWhere('key', SafeDealEscrowConfig::SETTING_KEY);

        $this->assertSame('vtb', $row['value']['provider']);
        $this->assertSame('wallet', $row['value']['effective'], 'админка должна показывать фактического провайдера');
    }

    public function test_settings_list_reports_provider_even_when_never_saved(): void
    {
        $this->assertDatabaseMissing('system_settings', ['key' => SafeDealEscrowConfig::SETTING_KEY]);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $row = collect($this->getJson('/api/v1/admin/settings', ['Authorization' => "Bearer {$token}"])
            ->assertOk()->json('data'))
            ->firstWhere('key', SafeDealEscrowConfig::SETTING_KEY);

        $this->assertNotNull($row, 'строка провайдера должна быть в списке всегда');
        $this->assertNull($row['value']['provider']);
        $this->assertSame('vtb', $row['value']['effective']);
    }

    public function test_audit_records_the_change(): void
    {
        $this->saveProvider('wallet')->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.settings.update']);
    }

    public function test_garbage_row_in_database_does_not_decide_about_money(): void
    {
        SystemSetting::query()->create([
            'key' => SafeDealEscrowConfig::SETTING_KEY,
            'group' => SafeDealEscrowConfig::GROUP,
            'value' => ['provider' => 'нечто'],
        ]);

        // Непонятная строка — не решение: работает окружение.
        $this->assertSame('vtb', $this->provider());
    }
}
