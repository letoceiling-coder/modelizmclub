<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Enums\OrdinaryDealStatus;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Message;
use App\Models\OrdinaryDeal;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Chat\Services\ChatService;
use Tests\TestCase;

/**
 * Обычная сделка: отметка продавца в переписке про объявление.
 */
class OrdinaryDealTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function user(string $name): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => $name,
            'slug' => Str::slug($name).'-'.uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function listing(User $seller, string $title = 'Катер 1:10'): Listing
    {
        $category = ListingCategory::query()->create(['name' => 'Корабли', 'slug' => 'ships-'.uniqid(), 'sort_order' => 1]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => $title,
            'slug' => 'l-'.uniqid(),
            'description' => 'Описание',
            'price_cents' => 250000,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    /** @return array{0: User, 1: User, 2: Listing, 3: Conversation} */
    private function listingChat(): array
    {
        $seller = $this->user('Продавец');
        $buyer = $this->user('Покупатель');
        $listing = $this->listing($seller);
        $conversation = app(ChatService::class)->findOrCreateDirect($buyer, $seller, $listing);

        return [$seller, $buyer, $listing, $conversation];
    }

    public function test_seller_marks_sold_in_listing_chat(): void
    {
        [$seller, $buyer, $listing, $conversation] = $this->listingChat();

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")
            ->assertCreated()
            ->assertJsonPath('data.type', 'ordinary')
            ->assertJsonPath('data.role', 'seller')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.amount_kopecks', 250000)
            ->assertJsonPath('data.conversation_uuid', $conversation->uuid)
            ->assertJsonPath('data.can.cancel', true)
            ->assertJsonPath('data.can.decline', false);

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status);
        $this->assertNotNull($listing->sold_at);

        $this->assertTrue(Message::query()->where('conversation_id', $conversation->id)->where('body', 'like', '%продано%')->exists());
        $this->assertSame(1, $buyer->fresh()->notifications()->where('data->type', 'deal')->count());
    }

    public function test_conversation_shows_the_deal_to_both_sides(): void
    {
        [$seller, $buyer, , $conversation] = $this->listingChat();

        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertOk()
            ->assertJsonPath('data.ordinary_deal', null)
            ->assertJsonPath('data.can_mark_sold', true);

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertJsonPath('data.can_mark_sold', false);

        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->assertCreated();

        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertJsonPath('data.ordinary_deal.role', 'seller')
            ->assertJsonPath('data.can_mark_sold', false);

        $list = $this->actingAs($buyer, 'sanctum')->getJson('/api/v1/conversations?per_page=50')->assertOk()->json('data');
        $row = collect($list)->firstWhere('uuid', $conversation->uuid);
        $this->assertSame('buyer', $row['ordinary_deal']['role']);
    }

    public function test_only_listing_author_can_mark_sold(): void
    {
        [, $buyer, , $conversation] = $this->listingChat();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")
            ->assertStatus(422);
        $this->assertSame(0, OrdinaryDeal::query()->count());
    }

    public function test_listing_must_have_been_discussed_in_the_chat(): void
    {
        [$seller, , , $conversation] = $this->listingChat();
        $other = $this->listing($seller, 'Другой лот');

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal", ['listing_uuid' => $other->uuid])
            ->assertStatus(422);
        $this->assertSame(ListingStatus::Published, $other->fresh()->status);
    }

    public function test_outsider_cannot_touch_the_chat(): void
    {
        [, , , $conversation] = $this->listingChat();
        $stranger = $this->user('Посторонний');

        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")
            ->assertNotFound();
    }

    public function test_cannot_mark_twice(): void
    {
        [$seller, , , $conversation] = $this->listingChat();
        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->assertCreated();

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")
            ->assertStatus(422);
        $this->assertSame(1, OrdinaryDeal::query()->count());
    }

    public function test_reserved_listing_cannot_be_marked(): void
    {
        [$seller, , $listing, $conversation] = $this->listingChat();
        $listing->forceFill(['reserved_at' => now()])->save();

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")
            ->assertStatus(422);
    }

    public function test_buyer_declines_and_listing_returns_to_sale(): void
    {
        [$seller, $buyer, $listing, $conversation] = $this->listingChat();
        $uuid = $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->json('data.uuid');

        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/ordinary-deals/{$uuid}/decline")->assertNotFound();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/ordinary-deals/{$uuid}/decline")
            ->assertOk()
            ->assertJsonPath('data.status', 'declined');

        $listing->refresh();
        $this->assertSame(ListingStatus::Published, $listing->status);
        $this->assertNull($listing->sold_at);
        $this->assertSame(OrdinaryDealStatus::Declined, OrdinaryDeal::query()->first()->status);

        $this->actingAs($buyer, 'sanctum')->getJson('/api/v1/ordinary-deals')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/conversations/{$conversation->uuid}")
            ->assertJsonPath('data.ordinary_deal', null)
            ->assertJsonPath('data.can_mark_sold', true);
    }

    public function test_seller_cancels_mark(): void
    {
        [$seller, $buyer, $listing, $conversation] = $this->listingChat();
        $uuid = $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->json('data.uuid');

        $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/ordinary-deals/{$uuid}/cancel")->assertNotFound();
        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/ordinary-deals/{$uuid}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertSame(ListingStatus::Published, $listing->fresh()->status);
        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/ordinary-deals/{$uuid}/cancel")->assertStatus(422);
    }

    public function test_closing_does_not_republish_a_listing_taken_down_meanwhile(): void
    {
        [$seller, $buyer, $listing, $conversation] = $this->listingChat();
        $uuid = $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->json('data.uuid');
        $listing->forceFill(['status' => ListingStatus::Unpublished])->save();

        $this->actingAs($buyer, 'sanctum')->postJson("/api/v1/ordinary-deals/{$uuid}/decline")->assertOk();
        $this->assertSame(ListingStatus::Unpublished, $listing->fresh()->status);
    }

    public function test_index_filters_by_role(): void
    {
        [$seller, $buyer, , $conversation] = $this->listingChat();
        $this->actingAs($seller, 'sanctum')->postJson("/api/v1/conversations/{$conversation->uuid}/ordinary-deal")->assertCreated();

        $this->actingAs($buyer, 'sanctum')->getJson('/api/v1/ordinary-deals?role=buyer')->assertJsonCount(1, 'data')->assertJsonPath('data.0.role', 'buyer')->assertJsonPath('data.0.counterpart.name', 'Продавец');
        $this->actingAs($buyer, 'sanctum')->getJson('/api/v1/ordinary-deals?role=seller')->assertJsonCount(0, 'data');
        $this->actingAs($seller, 'sanctum')->getJson('/api/v1/ordinary-deals?role=seller')->assertJsonCount(1, 'data');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/ordinary-deals')->assertUnauthorized();
    }
}
