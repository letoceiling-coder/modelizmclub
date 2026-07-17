<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Channel;
use App\Models\ChannelApplication;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\IconAsset;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Covers backend-endpoints-needed.md §26 (icon assets) and §27
 * (channel/community creation applications).
 */
class EntityRequestsAndIconsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function authHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
    }

    private function makeCategory(): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => 'Авиация',
            'slug' => 'aviation-'.uniqid(),
            'sort_order' => 1,
            'is_active' => true,
        ]);
    }

    // --- §27: channel applications ---

    public function test_user_can_apply_for_channel_and_duplicate_pending_is_rejected(): void
    {
        $user = User::factory()->create();
        $headers = $this->authHeaders($user);

        $this->postJson('/api/v1/channels/apply', [
            'name' => 'Мой канал о танках',
            'description' => 'Обзоры моделей',
            'category' => 'Бронетехника',
        ], $headers)
            ->assertCreated()
            ->assertJsonPath('data.kind', 'channel')
            ->assertJsonPath('data.proposedName', 'Мой канал о танках')
            ->assertJsonPath('data.status', 'pending');

        $this->postJson('/api/v1/channels/apply', [
            'name' => 'Второй канал',
        ], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['application']);
    }

    public function test_admin_can_list_approve_and_reject_channel_applications(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $applicant = User::factory()->create();
        $headers = $this->authHeaders($admin);

        $application = ChannelApplication::query()->create([
            'user_id' => $applicant->id,
            'proposed_name' => 'Канал про авиацию',
            'description' => null,
            'category' => 'Авиация',
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/admin/channels/applications?status=pending', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $application->id)
            ->assertJsonPath('data.0.kind', 'channel')
            ->assertJsonPath('data.0.applicant.id', $applicant->uuid);

        $this->postJson("/api/v1/admin/channels/applications/{$application->id}/approve", [], $headers)
            ->assertOk();

        $channel = Channel::query()->where('owner_id', $applicant->id)->first();
        $this->assertNotNull($channel, 'Approve должен создать канал с owner_id = заявитель');
        $this->assertSame('Канал про авиацию', $channel->name);
        $this->assertTrue($channel->is_active);

        $this->assertDatabaseHas('channel_applications', [
            'id' => $application->id,
            'status' => 'approved',
            'reviewed_by' => $admin->id,
        ]);

        // Повторное решение по уже рассмотренной заявке — 422.
        $this->postJson("/api/v1/admin/channels/applications/{$application->id}/reject", ['reason' => 'x'], $headers)
            ->assertStatus(422);

        $second = ChannelApplication::query()->create([
            'user_id' => $applicant->id,
            'proposed_name' => 'Ещё один канал',
            'status' => 'pending',
        ]);

        $this->postJson("/api/v1/admin/channels/applications/{$second->id}/reject", [
            'reason' => 'Недостаточно описания',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('channel_applications', [
            'id' => $second->id,
            'status' => 'rejected',
            'moderator_comment' => 'Недостаточно описания',
        ]);
    }

    // --- §27: community applications ---

    public function test_admin_approve_creates_community_with_owner_member(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $applicant = User::factory()->create();
        $category = $this->makeCategory();
        $headers = $this->authHeaders($admin);

        $application = CommunityApplication::query()->create([
            'user_id' => $applicant->id,
            'proposed_name' => 'Клуб стендового моделизма',
            'description' => 'Собираем всё',
            'category_id' => $category->id,
            'status' => 'pending',
        ]);

        $this->getJson('/api/v1/admin/communities/applications?status=pending', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.kind', 'community')
            ->assertJsonPath('data.0.category', $category->name);

        $this->postJson("/api/v1/admin/communities/applications/{$application->id}/approve", [], $headers)
            ->assertOk()
            ->assertJsonPath('data.name', 'Клуб стендового моделизма');

        $community = Community::query()->where('created_by', $applicant->id)->first();
        $this->assertNotNull($community, 'Approve должен создать сообщество');
        $this->assertSame('active', $community->status->value);
        $this->assertSame(1, $community->members_count);

        $this->assertDatabaseHas('community_members', [
            'community_id' => $community->id,
            'user_id' => $applicant->id,
            'role' => 'owner',
        ]);

        $this->assertDatabaseHas('community_applications', [
            'id' => $application->id,
            'status' => 'approved',
            'reviewed_by' => $admin->id,
        ]);

        // Владелец видит is_owner=true в карточке сообщества. Guard кэширует
        // пользователя в рамках одного теста — сбрасываем перед сменой токена.
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/communities/{$community->slug}", $this->authHeaders($applicant))
            ->assertOk()
            ->assertJsonPath('data.is_owner', true);
    }

    public function test_admin_can_reject_community_application_with_reason(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $applicant = User::factory()->create();
        $category = $this->makeCategory();
        $headers = $this->authHeaders($admin);

        $application = CommunityApplication::query()->create([
            'user_id' => $applicant->id,
            'proposed_name' => 'Спам-сообщество',
            'category_id' => $category->id,
            'status' => 'pending',
        ]);

        $this->postJson("/api/v1/admin/communities/applications/{$application->id}/reject", [
            'reason' => 'Название нарушает правила',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('community_applications', [
            'id' => $application->id,
            'status' => 'rejected',
            'moderator_comment' => 'Название нарушает правила',
        ]);

        $this->assertDatabaseMissing('communities', [
            'name' => 'Спам-сообщество',
        ]);
    }

    public function test_applications_endpoints_require_moderator_role(): void
    {
        $user = User::factory()->create(['role' => UserRole::User]);
        $headers = $this->authHeaders($user);

        $this->getJson('/api/v1/admin/communities/applications', $headers)->assertForbidden();
        $this->getJson('/api/v1/admin/channels/applications', $headers)->assertForbidden();
    }

    // --- §27: /me/entity-requests ---

    public function test_me_entity_requests_aggregates_both_kinds(): void
    {
        $user = User::factory()->create();
        $category = $this->makeCategory();
        $headers = $this->authHeaders($user);

        CommunityApplication::query()->create([
            'user_id' => $user->id,
            'proposed_name' => 'Моё сообщество',
            'category_id' => $category->id,
            'status' => 'pending',
        ]);

        ChannelApplication::query()->create([
            'user_id' => $user->id,
            'proposed_name' => 'Мой канал',
            'status' => 'rejected',
            'moderator_comment' => 'Причина',
        ]);

        $response = $this->getJson('/api/v1/me/entity-requests', $headers)->assertOk();

        $kinds = collect($response->json('data'))->pluck('kind')->sort()->values()->all();
        $this->assertSame(['channel', 'community'], $kinds);
    }

    // --- §26: icon assets ---

    private function iconUpload(string $svg, string $name = 'icon.svg'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $svg);
    }

    public function test_admin_can_upload_icon_and_it_is_sanitized_and_tokenized(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">'
            .'<script>alert(1)</script>'
            .'<path d="M0 0h24v24H0z" fill="#ff0000" onclick="evil()"/>'
            .'</svg>';

        $response = $this->post('/api/v1/media', [
            'purpose' => 'icon',
            'file' => $this->iconUpload($svg, 'tank.svg'),
        ], array_merge($headers, ['Accept' => 'application/json']))->assertCreated();

        $data = $response->json('data');
        $this->assertSame('tank', $data['name']);
        $this->assertSame('svg', $data['format']);
        $this->assertStringNotContainsString('<script', $data['svg']);
        $this->assertStringNotContainsString('onclick', $data['svg']);
        $this->assertStringNotContainsString('#ff0000', $data['svg']);
        $this->assertStringContainsString('currentColor', $data['svg']);
        $this->assertStringNotContainsString('width="24"', $data['svg']);

        $this->assertDatabaseHas('icon_assets', ['id' => (int) $data['id'], 'name' => 'tank']);
    }

    public function test_admin_can_upload_png_icon(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        $response = $this->post('/api/v1/media', [
            'purpose' => 'icon',
            'file' => UploadedFile::fake()->image('badge.png', 32, 32),
        ], array_merge($headers, ['Accept' => 'application/json']))->assertCreated();

        $data = $response->json('data');
        $this->assertSame('badge', $data['name']);
        $this->assertSame('png', $data['format']);
        $this->assertNull($data['svg']);
        $this->assertNotEmpty($data['url']);

        $this->assertDatabaseHas('icon_assets', [
            'id' => (int) $data['id'],
            'name' => 'badge',
            'format' => 'png',
        ]);
        $this->assertDatabaseHas('media', [
            'id' => IconAsset::query()->find((int) $data['id'])?->media_id,
            'mime_type' => 'image/png',
        ]);
    }

    public function test_admin_can_register_icon_from_media_manager_upload(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        $media = \App\Models\Media::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'disk' => config('filesystems.default', 'local'),
            'path' => 'media/icon/2026/07/test-icon.png',
            'filename' => 'from-media.png',
            'mime_type' => 'image/png',
            'size_bytes' => 1024,
            'uploaded_by' => $admin->id,
            'status' => \App\Enums\MediaStatus::Ready,
        ]);
        \Illuminate\Support\Facades\Storage::disk($media->disk)->put($media->path, 'png-bytes');

        $this->getJson('/api/v1/admin/icon-media?unregistered=1', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $media->uuid);

        $assetResponse = $this->postJson('/api/v1/admin/icon-assets/from-media', [
            'media_uuid' => $media->uuid,
        ], $headers)->assertCreated();

        $this->assertSame('from-media', $assetResponse->json('data.name'));
        $this->assertSame('png', $assetResponse->json('data.format'));
        $this->assertSame($media->uuid, $assetResponse->json('data.mediaUuid'));
    }

    public function test_multicolor_icon_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
            .'<rect x="0" y="0" fill="#ff0000"/><circle cx="1" cy="1" r="1" fill="#00ff00"/>'
            .'</svg>';

        $this->post('/api/v1/media', [
            'purpose' => 'icon',
            'file' => $this->iconUpload($svg),
        ], array_merge($headers, ['Accept' => 'application/json']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_icon_upload_is_admin_only(): void
    {
        $user = User::factory()->create(['role' => UserRole::User]);

        $this->post('/api/v1/media', [
            'purpose' => 'icon',
            'file' => $this->iconUpload('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        ], array_merge($this->authHeaders($user), ['Accept' => 'application/json']))->assertForbidden();
    }

    public function test_admin_can_list_and_soft_delete_icon_assets(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        $asset = IconAsset::query()->create([
            'name' => 'plane',
            'svg' => '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" fill="currentColor"/></svg>',
            'source' => 'upload',
            'uploaded_by' => $admin->id,
        ]);

        $this->getJson('/api/v1/admin/icon-assets', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $asset->id)
            ->assertJsonPath('data.0.name', 'plane');

        $this->deleteJson("/api/v1/admin/icon-assets/{$asset->id}", [], $headers)->assertOk();

        $this->assertSoftDeleted('icon_assets', ['id' => $asset->id]);

        $this->getJson('/api/v1/admin/icon-assets', $headers)
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    // --- §26: public icon-overrides ---

    public function test_icon_overrides_returns_empty_object_when_not_published(): void
    {
        $this->getJson('/api/v1/icon-overrides')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_icon_overrides_returns_published_map(): void
    {
        $map = [
            'nav.home' => ['assetId' => '1', 'svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>', 'token' => 'accent'],
        ];

        SystemSetting::query()->create([
            'key' => 'icon_overrides',
            'value' => $map,
            'group' => 'design',
        ]);

        $response = $this->getJson('/api/v1/icon-overrides')->assertOk();
        $this->assertSame('accent', $response->json('data')['nav.home']['token']);
    }

    public function test_settings_update_logs_old_values_for_rollback(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $headers = $this->authHeaders($admin);

        SystemSetting::query()->create([
            'key' => 'icon_overrides',
            'value' => ['nav.home' => ['assetId' => '1', 'svg' => '<svg/>', 'token' => 'accent']],
            'group' => 'design',
        ]);

        $this->patchJson('/api/v1/admin/settings', [
            'settings' => [[
                'key' => 'icon_overrides',
                'value' => ['nav.home' => ['assetId' => '2', 'svg' => '<svg/>', 'token' => 'danger']],
                'group' => 'design',
            ]],
        ], $headers)->assertOk();

        $log = \App\Models\AuditLog::query()->where('action', 'admin.settings.update')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertArrayHasKey('icon_overrides', $log->old_values);
        $this->assertSame('accent', $log->old_values['icon_overrides']['nav.home']['token']);
    }

    // --- feature flags ---

    public function test_feature_flags_include_market_and_escrow(): void
    {
        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.market_enabled', false)
            ->assertJsonPath('data.escrow_enabled', false)
            ->assertJsonPath('data.listing_payment_enabled', false);

        SystemSetting::query()->create([
            'key' => 'feature.escrow_enabled',
            'value' => ['enabled' => true],
            'group' => 'feature',
        ]);

        $this->getJson('/api/v1/public/feature-flags')
            ->assertOk()
            ->assertJsonPath('data.escrow_enabled', true);
    }
}
