<?php

namespace Tests\Feature;

use App\Enums\CommunityMemberRole;
use App\Enums\CommunityStatus;
use App\Enums\ContentStatus;
use App\Enums\ConversationType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\City;
use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\CommunityJoinRequest;
use App\Models\Conversation;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CommunityHubTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_apply_payload_is_hydrated_on_approve(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $applicant = User::factory()->create(['status' => UserStatus::Active]);
        $category = $this->communityCategory();
        $city = $this->city();
        $topic = $this->postCategory('Aviation', 'aviation-hub');

        $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/v1/communities/apply', [
                'proposed_name' => 'RC Planes Club',
                'description' => 'Узкий клуб по авиамоделям',
                'category_id' => $category->id,
                'city_id' => $city->id,
                'post_category_ids' => [$topic->id],
                'custom_category' => 'Кордовые самолёты',
                'rules' => 'Без оффтопа.',
                'access_type' => 'request',
                'contacts' => [
                    'telegram' => 'https://t.me/rcplanes',
                    'website' => 'https://rcplanes.example',
                    'phone' => '+79990001122',
                ],
            ])
            ->assertCreated();

        $application = CommunityApplication::query()->first();
        $this->assertNotNull($application);
        $this->assertSame('request', $application->payload['access_type'] ?? null);
        $this->assertSame($city->id, $application->payload['city_id'] ?? null);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/communities/applications/{$application->id}/approve")
            ->assertOk();

        $community = Community::query()->where('created_by', $applicant->id)->first();
        $this->assertNotNull($community);
        $this->assertSame('request', $community->access_type);
        $this->assertSame($city->id, $community->city_id);
        $this->assertSame('Без оффтопа.', $community->rules);
        $this->assertSame('Кордовые самолёты', $community->custom_category);
        $this->assertSame('https://t.me/rcplanes', $community->contacts['telegram'] ?? null);
        $this->assertTrue($community->topicCategories()->whereKey($topic->id)->exists());
        $this->assertDatabaseHas('conversations', [
            'community_id' => $community->id,
            'type' => ConversationType::Community->value,
        ]);
        $conversation = Conversation::query()->where('community_id', $community->id)->first();
        $this->assertDatabaseHas('conversation_participants', [
            'conversation_id' => $conversation->id,
            'user_id' => $applicant->id,
        ]);
    }

    public function test_community_posts_are_hidden_from_main_feed(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $community = $this->openCommunity($owner);
        $postCategory = $this->postCategory('Feed', 'feed-hub');

        $communityPost = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'community_id' => $community->id,
            'category_id' => $postCategory->id,
            'title' => 'Только в клубе',
            'body' => 'Не должно попасть в ленту',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $publicPost = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'category_id' => $postCategory->id,
            'title' => 'Публичный пост',
            'body' => 'Виден в ленте',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $feed = $this->getJson('/api/v1/feed')->assertOk()->json('data');
        $ids = collect($feed)->pluck('uuid')->all();
        $this->assertContains($publicPost->uuid, $ids);
        $this->assertNotContains($communityPost->uuid, $ids);

        $wall = $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}/posts")
            ->assertOk()
            ->json('data');
        $this->assertContains($communityPost->uuid, collect($wall)->pluck('uuid')->all());
    }

    public function test_open_join_adds_member_and_chat_participant(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $member = User::factory()->create(['status' => UserStatus::Active]);
        $community = $this->openCommunity($owner);

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/v1/communities/{$community->slug}/join")
            ->assertOk()
            ->assertJsonPath('status', 'member');

        $this->assertDatabaseHas('community_members', [
            'community_id' => $community->id,
            'user_id' => $member->id,
        ]);

        $conversation = Conversation::query()
            ->where('community_id', $community->id)
            ->where('type', ConversationType::Community)
            ->first();
        $this->assertNotNull($conversation);
        $this->assertDatabaseHas('conversation_participants', [
            'conversation_id' => $conversation->id,
            'user_id' => $member->id,
        ]);

        $this->actingAs($member, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}/chat")
            ->assertOk()
            ->assertJsonPath('data.conversation_uuid', $conversation->uuid);

        $this->actingAs($member, 'sanctum')
            ->getJson('/api/v1/conversations?space=communities')
            ->assertOk()
            ->assertJsonPath('data.0.uuid', $conversation->uuid)
            ->assertJsonPath('data.0.community.slug', $community->slug);
    }

    public function test_closed_join_creates_pending_request_until_approved(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $member = User::factory()->create(['status' => UserStatus::Active]);
        $community = $this->openCommunity($owner, accessType: 'request');

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/v1/communities/{$community->slug}/join")
            ->assertOk()
            ->assertJsonPath('status', 'pending');

        $this->assertDatabaseMissing('community_members', [
            'community_id' => $community->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('community_join_requests', [
            'community_id' => $community->id,
            'user_id' => $member->id,
            'status' => CommunityJoinRequest::STATUS_PENDING,
        ]);

        $requestId = CommunityJoinRequest::query()->value('id');
        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}/join-requests")
            ->assertOk()
            ->assertJsonPath('data.0.id', $requestId);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/communities/{$community->slug}/join-requests/{$requestId}/approve")
            ->assertOk();

        $this->assertDatabaseHas('community_members', [
            'community_id' => $community->id,
            'user_id' => $member->id,
        ]);
    }

    public function test_member_can_rsvp_to_event_and_posts_are_marked_read(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Active]);
        $member = User::factory()->create(['status' => UserStatus::Active]);
        $community = $this->openCommunity($owner);
        $community->members()->attach($member->id, [
            'role' => CommunityMemberRole::Member->value,
            'joined_at' => now(),
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/communities/{$community->slug}/events", [
                'title' => 'Вечерняя встреча',
                'starts_at' => now()->addDay()->toIso8601String(),
                'location_name' => 'Парк',
                'latitude' => 45.03,
                'longitude' => 38.97,
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Вечерняя встреча');

        $eventUuid = $this->actingAs($member, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}/events")
            ->assertOk()
            ->json('data.0.uuid');

        $this->actingAs($member, 'sanctum')
            ->postJson("/api/v1/communities/{$community->slug}/events/{$eventUuid}/attend")
            ->assertOk()
            ->assertJsonPath('going', true);

        $postCategory = $this->postCategory('Wall', 'wall-hub');
        $post = Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'community_id' => $community->id,
            'category_id' => $postCategory->id,
            'title' => 'Новость клуба',
            'body' => 'Текст',
            'status' => ContentStatus::Published,
            'published_at' => now(),
        ]);

        $this->actingAs($member, 'sanctum')
            ->getJson("/api/v1/communities/{$community->slug}/posts")
            ->assertOk();

        $this->assertDatabaseHas('community_members', [
            'community_id' => $community->id,
            'user_id' => $member->id,
            'last_read_post_id' => $post->id,
        ]);
    }

    private function communityCategory(): CommunityCategory
    {
        return CommunityCategory::query()->create([
            'name' => 'Official',
            'slug' => 'official-hub-'.Str::random(6),
            'sort_order' => 1,
            'depth' => 0,
            'is_active' => true,
        ]);
    }

    private function postCategory(string $name, string $slug): PostCategory
    {
        return PostCategory::query()->create([
            'name' => $name,
            'slug' => $slug.'-'.Str::random(4),
            'sort_order' => 10,
            'depth' => 0,
            'path' => $slug,
            'is_active' => true,
        ]);
    }

    private function city(): City
    {
        return City::query()->create([
            'name' => 'Краснодар',
            'region' => 'Краснодарский край',
            'slug' => 'krasnodar-hub-'.Str::random(6),
            'sort_order' => 1,
            'is_active' => true,
        ]);
    }

    private function openCommunity(User $owner, string $accessType = 'open'): Community
    {
        $community = Community::query()->create([
            'category_id' => $this->communityCategory()->id,
            'name' => 'Hub Club',
            'slug' => 'hub-club-'.Str::random(6),
            'status' => CommunityStatus::Active,
            'approved_at' => now(),
            'created_by' => $owner->id,
            'access_type' => $accessType,
            'members_count' => 1,
        ]);
        $community->members()->attach($owner->id, [
            'role' => CommunityMemberRole::Owner->value,
            'joined_at' => now(),
        ]);

        return $community;
    }
}
