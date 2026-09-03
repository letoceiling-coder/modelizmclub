<?php

namespace Tests\Feature;

use App\Enums\ConversationType;
use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserStatus;
use App\Enums\WalletTransactionType;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Message;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserProfile;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Billing\Services\WalletService;
use Tests\TestCase;

/**
 * The chat that a safe deal opens for its two sides.
 *
 * Starting a deal must produce a `deal` conversation holding buyer and seller,
 * every status change must be narrated in it, and access must depend on being
 * a participant — nothing else.
 */
class SafeDealChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        config([
            'billing.safe_deal.escrow_provider' => 'wallet',
            'billing.safe_deal.platform_fee_percent' => 5,
        ]);
        SystemSetting::query()->updateOrCreate(
            ['key' => 'feature.listing_payment_enabled'],
            ['value' => ['enabled' => false], 'group' => 'feature'],
        );
    }

    private function seedUser(string $suffix): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    private function seedListing(User $seller, int $priceCents = 100000): Listing
    {
        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);

        return Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Тестовый лот',
            'slug' => 'test-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => $priceCents,
            'currency' => 'RUB',
            'status' => ListingStatus::Published,
            'published_at' => now(),
        ]);
    }

    /** @return array{0: User, 1: User, 2: SafeDeal} */
    private function startDeal(): array
    {
        $seller = $this->seedUser('seller');
        $buyer = $this->seedUser('buyer');
        $listing = $this->seedListing($seller);
        app(WalletService::class)->credit($buyer, 200000, WalletTransactionType::Topup, 'test');

        $uuid = $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/listings/{$listing->uuid}/safe-deal", ['accept_terms' => true])
            ->assertCreated()
            ->assertJsonPath('data.status', 'paid')
            ->json('data.uuid');

        return [$seller, $buyer, SafeDeal::query()->where('uuid', $uuid)->firstOrFail()];
    }

    /** @return array<int, string> */
    private function systemBodies(Conversation $conversation): array
    {
        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('type', 'system')
            ->orderBy('id')
            ->get()
            ->map(fn (Message $m) => (string) $m->body)
            ->all();
    }

    public function test_creating_a_deal_opens_a_deal_chat_with_both_sides_and_a_system_notice(): void
    {
        [$seller, $buyer, $deal] = $this->startDeal();

        $this->assertNotNull($deal->conversation_id);

        $conversation = $deal->conversation;
        $this->assertSame(ConversationType::Deal, $conversation->type);
        $this->assertSame($deal->listing_id, $conversation->listing_id);

        $participantIds = $conversation->participants()->pluck('user_id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $expected = collect([$buyer->id, $seller->id])->map(fn ($id) => (int) $id)->sort()->values()->all();
        $this->assertSame($expected, $participantIds);

        $bodies = $this->systemBodies($conversation);
        $this->assertCount(1, $bodies);
        $this->assertStringContainsString(mb_substr($deal->uuid, 0, 8), $bodies[0]);
        $this->assertStringContainsString('создана', $bodies[0]);
        $this->assertStringContainsString(SafeDealStatus::Paid->label(), $bodies[0]);
    }

    public function test_status_changes_append_system_notices_to_the_same_chat(): void
    {
        [$seller, $buyer, $deal] = $this->startDeal();
        $conversationId = $deal->conversation_id;

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/ship", ['tracking_number' => 'TRACK-1'])
            ->assertOk();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/confirm")
            ->assertOk();

        $deal->refresh();
        $this->assertSame($conversationId, $deal->conversation_id, 'the deal keeps its original chat');
        $this->assertSame(SafeDealStatus::Completed, $deal->status);

        $bodies = $this->systemBodies($deal->conversation);

        // created → shipped → completed; the commission ledger entry moves no
        // status and must not add a fourth notice.
        $this->assertCount(3, $bodies);
        $this->assertStringContainsString(SafeDealStatus::Shipped->label(), $bodies[1]);
        $this->assertStringContainsString(SafeDealStatus::Completed->label(), $bodies[2]);
    }

    public function test_cancelling_a_deal_is_narrated_in_the_chat(): void
    {
        [, $buyer, $deal] = $this->startDeal();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/safe-deals/{$deal->uuid}/cancel")
            ->assertOk();

        $bodies = $this->systemBodies($deal->fresh()->conversation);

        $this->assertCount(2, $bodies);
        $this->assertStringContainsString(SafeDealStatus::Cancelled->label(), $bodies[1]);
    }

    public function test_both_sides_can_read_and_write_the_deal_chat_without_a_subscription(): void
    {
        [$seller, $buyer, $deal] = $this->startDeal();
        $uuid = $deal->conversation->uuid;

        $this->assertFalse($buyer->fresh()->hasActiveSubscription());
        $this->assertFalse($seller->fresh()->hasActiveSubscription());

        $this->actingAs($buyer, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}")
            ->assertOk()
            ->assertJsonPath('data.type', 'deal')
            ->assertJsonPath('data.deal.uuid', $deal->uuid)
            ->assertJsonPath('data.deal.status', 'paid')
            ->assertJsonPath('data.deal.status_label', SafeDealStatus::Paid->label());

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Когда отправите?'])
            ->assertCreated();

        $this->actingAs($seller, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Завтра.'])
            ->assertCreated();

        $messages = $this->actingAs($seller, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}/messages")
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($messages);
        $system = collect($messages)->firstWhere('type', 'system');
        $this->assertNotNull($system, 'the system notice is returned by the messages endpoint');
        $this->assertNull($system['author'] ?? null, 'a system notice has no author');
    }

    public function test_an_outsider_cannot_read_or_write_the_deal_chat(): void
    {
        [, , $deal] = $this->startDeal();
        $stranger = $this->seedUser('stranger');
        $uuid = $deal->conversation->uuid;

        $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/v1/conversations/{$uuid}")
            ->assertForbidden();

        $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/v1/conversations/{$uuid}/messages", ['body' => 'Привет'])
            ->assertForbidden();
    }

    public function test_the_deal_chat_is_listed_for_both_sides_with_its_deal_block(): void
    {
        [$seller, , $deal] = $this->startDeal();

        $items = $this->actingAs($seller, 'sanctum')
            ->getJson('/api/v1/conversations?per_page=50')
            ->assertOk()
            ->json('data');

        $row = collect($items)->firstWhere('uuid', $deal->conversation->uuid);

        $this->assertNotNull($row, 'the deal chat shows up in the conversation list');
        $this->assertSame('deal', $row['type']);
        $this->assertSame($deal->uuid, $row['deal']['uuid']);
        $this->assertSame('paid', $row['deal']['status']);
    }
}
