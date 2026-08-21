<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Models\User;
use App\Enums\UserRole;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FooterContactsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_public_footer_contacts_returns_only_filled_fields(): void
    {
        SystemSetting::query()->create([
            'key' => 'footer.contacts',
            'group' => 'footer',
            'value' => [
                'email' => 'support@modelizmclub.ru',
                'phone' => '',
                'hours' => 'Пн–Вс 10:00–20:00',
                'social' => [
                    ['label' => 'VK', 'url' => 'https://vk.com/modelizm'],
                    ['label' => 'MAX', 'url' => ''],
                ],
            ],
        ]);

        $this->getJson('/api/v1/public/footer-contacts')
            ->assertOk()
            ->assertJsonPath('data.email', 'support@modelizmclub.ru')
            ->assertJsonPath('data.hours', 'Пн–Вс 10:00–20:00')
            ->assertJsonMissingPath('data.phone')
            ->assertJsonPath('data.social.0.label', 'VK');
    }

    public function test_admin_can_save_footer_contacts(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $token = $admin->createToken('api')->plainTextToken;

        $this->patchJson('/api/v1/admin/settings', [
            'settings' => [[
                'key' => 'footer.contacts',
                'group' => 'footer',
                'value' => [
                    'email' => 'hello@modelizmclub.ru',
                    'phone' => '8 800 111-22-33',
                    'hours' => 'Пн–Пт 9:00–18:00',
                    'social' => [
                        ['label' => 'Telegram', 'url' => 'https://t.me/modelizm'],
                    ],
                ],
            ]],
        ], ['Authorization' => 'Bearer '.$token])
            ->assertOk();

        $this->getJson('/api/v1/public/footer-contacts')
            ->assertOk()
            ->assertJsonPath('data.email', 'hello@modelizmclub.ru')
            ->assertJsonPath('data.phone', '8 800 111-22-33')
            ->assertJsonPath('data.social.0.url', 'https://t.me/modelizm');
    }

    public function test_public_footer_contacts_include_legal_requisites(): void
    {
        SystemSetting::query()->create([
            'key' => 'footer.contacts',
            'group' => 'footer',
            'value' => [
                'legal_name' => 'ООО «МОДЕЛИЗМ»',
                'inn' => '2312341754',
                'ogrn' => '1262300020751',
                'address' => 'г. Краснодар',
                'email' => 'support@modelizmclub.ru',
            ],
        ]);

        $this->getJson('/api/v1/public/footer-contacts')
            ->assertOk()
            ->assertJsonPath('data.legal_name', 'ООО «МОДЕЛИЗМ»')
            ->assertJsonPath('data.inn', '2312341754')
            ->assertJsonPath('data.ogrn', '1262300020751')
            ->assertJsonPath('data.address', 'г. Краснодар');
    }
}
