<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\ListingStatus;
use App\Enums\MediaStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\ClubEvent;
use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Media;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Video;
use App\Models\VideoCategory;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\WalletService;
use Modules\Feed\Services\CommentService;
use Modules\Listing\Services\ListingService;
use Modules\Video\Services\VideoService;
use Tests\TestCase;

/**
 * Роль площадки внутри чужой сущности — только модерация.
 *
 * Модератор и администратор площадки убирают, снимают, отменяют и смотрят,
 * но не действуют от имени хозяина: не создают событий в чужом сообществе,
 * не правят его настройки, не подтверждают получение за покупателя, не
 * правят чужое объявление, комментарий или видео и не читают чужие
 * голосовые. Разбор 17.09 — продолжение fix/channel-permissions.
 */
class PlatformRoleBoundariesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config(['billing.safe_deal.escrow_provider' => 'wallet', 'billing.safe_deal.platform_fee_percent' => 5]);
        SystemSetting::query()->updateOrCreate(['key' => 'feature.listing_payment_enabled'], ['value' => ['enabled' => false], 'group' => 'feature']);
    }

    private function user(UserRole $role = UserRole::User): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
    }

    /** @return array{0: Community, 1: User, 2: User} сообщество, владелец, модератор сообщества */
    private function community(): array
    {
        $owner = $this->user();
        $communityModerator = $this->user();
        $category = CommunityCategory::query()->create(['name' => 'Клубы', 'slug' => 'clubs-'.uniqid(), 'is_active' => true]);
        $community = Community::create([
            'category_id' => $category->id, 'name' => 'Клуб', 'slug' => 'club-'.uniqid(),
            'status' => CommunityStatus::Active, 'approved_at' => now(), 'created_by' => $owner->id, 'members_count' => 2,
        ]);
        $community->members()->attach($owner->id, ['role' => CommunityMemberRole::Owner->value, 'joined_at' => now()]);
        $community->members()->attach($communityModerator->id, ['role' => CommunityMemberRole::Moderator->value, 'joined_at' => now()]);

        return [$community, $owner, $communityModerator];
    }

    private function eventPayload(): array
    {
        return ['title' => 'Встреча клуба', 'starts_at' => now()->addWeek()->toIso8601String(), 'status' => 'published'];
    }

    public function test_community_events_are_created_by_the_community_team_only(): void
    {
        [$community, $owner, $communityModerator] = $this->community();
        $url = "/api/v1/communities/{$community->slug}/events";

        $this->actingAs($this->user(UserRole::Moderator), 'sanctum')->postJson($url, $this->eventPayload())->assertForbidden();
        $this->actingAs($this->user(UserRole::Admin), 'sanctum')->postJson($url, $this->eventPayload())->assertForbidden();
        $this->actingAs($this->user(), 'sanctum')->postJson($url, $this->eventPayload())->assertForbidden();
        $this->actingAs($owner, 'sanctum')->postJson($url, $this->eventPayload())->assertCreated();
        $this->actingAs($communityModerator, 'sanctum')->postJson($url, $this->eventPayload())->assertCreated();
    }

    public function test_platform_moderator_can_cancel_or_remove_but_not_edit_an_event(): void
    {
        [$community, $owner] = $this->community();
        $moderator = $this->user(UserRole::Moderator);
        $first = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/communities/{$community->slug}/events", $this->eventPayload())->json('data.uuid');
        $second = $this->actingAs($owner, 'sanctum')->postJson("/api/v1/communities/{$community->slug}/events", $this->eventPayload())->json('data.uuid');

        $this->actingAs($moderator, 'sanctum')->patchJson("/api/v1/events/{$first}", ['title' => 'Переписано модератором'])->assertForbidden();
        $this->actingAs($moderator, 'sanctum')->getJson("/api/v1/events/{$first}")->assertOk()
            ->assertJsonPath('data.can.update', false)
            ->assertJsonPath('data.can.cancel', true)
            ->assertJsonPath('data.can.delete', true);
        $this->actingAs($moderator, 'sanctum')->postJson("/api/v1/events/{$first}/cancel", ['reason' => 'Нарушение правил'])->assertOk();
        $this->assertSame(ClubEvent::STATUS_CANCELLED, ClubEvent::query()->where('uuid', $first)->value('status'));
        $this->actingAs($moderator, 'sanctum')->deleteJson("/api/v1/events/{$second}")->assertOk();
    }

    public function test_platform_roles_do_not_run_someone_elses_community(): void
    {
        [$community, $owner, $communityModerator] = $this->community();
        foreach ([$this->user(UserRole::Moderator), $this->user(UserRole::Admin)] as $staff) {
            $this->actingAs($staff, 'sanctum')->patchJson("/api/v1/communities/{$community->slug}", ['description' => 'Чужое описание'])->assertForbidden();
            $this->actingAs($staff, 'sanctum')->getJson("/api/v1/communities/{$community->slug}/join-requests")->assertForbidden();
            $this->actingAs($staff, 'sanctum')->getJson("/api/v1/communities/{$community->slug}")->assertOk()
                ->assertJsonPath('data.can_manage', false);
        }
        $this->actingAs($communityModerator, 'sanctum')->getJson("/api/v1/communities/{$community->slug}/join-requests")->assertOk();
    }

    private function listing(User $seller): Listing
    {
        $category = ListingCategory::query()->create(['name' => 'RC', 'slug' => 'rc-'.uniqid(), 'sort_order' => 1]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(), 'user_id' => $seller->id, 'category_id' => $category->id,
            'title' => 'Катер', 'slug' => 'l-'.uniqid(), 'description' => 'Описание', 'price_cents' => 100000,
            'currency' => 'RUB', 'status' => ListingStatus::Published, 'published_at' => now(),
        ]);
    }

    public function test_platform_moderator_takes_down_but_does_not_edit_a_listing(): void
    {
        $seller = $this->user();
        $listing = $this->listing($seller);
        $moderator = $this->user(UserRole::Moderator);
        $service = app(ListingService::class);

        try {
            $service->update($listing, $moderator, ['title' => 'Переписано модератором']);
            $this->fail('модератор площадки правит чужое объявление');
        } catch (ValidationException) {
        }
        $this->assertSame('Катер', $listing->fresh()->title);

        $service->setStatus($listing->fresh(), $moderator, ListingStatus::Unpublished);
        $this->assertSame(ListingStatus::Unpublished, $listing->fresh()->status);

        try {
            $service->setStatus($listing->fresh(), $moderator, ListingStatus::Published);
            $this->fail('модератор площадки публикует чужое объявление');
        } catch (ValidationException) {
        }
    }

    public function test_platform_moderator_removes_but_does_not_edit_a_comment(): void
    {
        $author = $this->user();
        $post = Post::query()->create(['user_id' => $author->id, 'title' => 'Пост', 'body' => 'Текст', 'status' => 'published', 'published_at' => now(), 'category_id' => PostCategory::query()->create(['name' => 'А', 'slug' => 'a-'.uniqid(), 'is_active' => true])->id]);
        $comment = Comment::query()->create(['uuid' => (string) Str::uuid(), 'commentable_type' => Post::class, 'commentable_id' => $post->id, 'user_id' => $author->id, 'body' => 'Мой комментарий']);
        $moderator = $this->user(UserRole::Moderator);

        $this->assertFalse($moderator->can('update', $comment));
        $this->assertTrue($moderator->can('delete', $comment));
        app(CommentService::class)->delete($comment, $moderator);
        $this->assertNull(Comment::query()->find($comment->id));
    }

    public function test_platform_roles_do_not_act_inside_a_safe_deal(): void
    {
        $seller = $this->user();
        $buyer = $this->user();
        $listing = $this->listing($seller);
        app(WalletService::class)->credit($buyer, 200000, WalletTransactionType::Topup, 'test');
        $uuid = $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])->assertCreated()->json('data.uuid');

        foreach ([$this->user(UserRole::Moderator), $this->user(UserRole::Admin)] as $staff) {
            foreach (['ship', 'delivered', 'confirm', 'cancel'] as $action) {
                $status = $this->actingAs($staff, 'sanctum')->postJson("/api/v1/safe-deals/{$uuid}/{$action}", ['tracking_number' => 'X1'])->status();
                $this->assertContains($status, [403, 422], "{$staff->role->value} {$action} → {$status}");
            }
        }
        $this->assertSame(SafeDealStatus::Paid, SafeDeal::query()->where('uuid', $uuid)->firstOrFail()->status);
    }

    public function test_video_is_edited_by_uploader_and_removed_by_moderation(): void
    {
        $uploader = $this->user();
        $media = Media::create(['disk' => 's3', 'path' => 'media/v.mp4', 'filename' => 'v.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => 10, 'uploaded_by' => $uploader->id, 'status' => MediaStatus::Ready]);
        $category = VideoCategory::query()->create(['uuid' => (string) Str::uuid(), 'slug' => 'v-'.uniqid(), 'title' => 'Обзоры', 'is_active' => true]);
        $video = Video::query()->create(['uuid' => (string) Str::uuid(), 'title' => 'Обзор', 'category_id' => $category->id, 'video_media_id' => $media->id, 'uploader_id' => $uploader->id, 'status' => 'published', 'published_at' => now(), 'tags' => []]);
        $admin = $this->user(UserRole::Admin);
        $service = app(VideoService::class);

        try {
            $service->update($video, $admin, ['title' => 'Переписано администратором']);
            $this->fail('администратор площадки правит чужое видео');
        } catch (ValidationException) {
        }
        $this->assertSame('Обзор', $video->fresh()->title);

        $service->delete($video->fresh(), $this->user(UserRole::Moderator));
        $this->assertNull(Video::query()->find($video->id));
    }

    public function test_admin_does_not_transcribe_someone_elses_voice(): void
    {
        $owner = $this->user();
        $voice = Media::create(['disk' => 's3', 'path' => 'media/voice/voice.webm', 'filename' => 'voice.webm', 'mime_type' => 'audio/webm', 'size_bytes' => 10, 'uploaded_by' => $owner->id, 'status' => MediaStatus::Ready]);

        $this->actingAs($this->user(UserRole::Admin), 'sanctum')->postJson("/api/v1/media/{$voice->uuid}/transcribe")->assertForbidden();
    }
}
