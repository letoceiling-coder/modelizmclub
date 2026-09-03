<?php

namespace Tests\Feature\Policies;

use App\Enums\ContentStatus;
use App\Enums\ConversationType;
use App\Enums\DisputeStatus;
use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Comment;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Dispute;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Message;
use App\Models\Post;
use App\Models\SafeDeal;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use Database\Seeders\SubscriptionPlansSeeder;
use Illuminate\Support\Str;

/** Minimal fixtures for the policy tests — no factories exist beyond User. */
trait PolicyFixtures
{
    protected function seedUser(string $suffix = 'u', UserRole $role = UserRole::User): User
    {
        $user = User::factory()->create(['status' => UserStatus::Active, 'role' => $role]);
        UserProfile::create([
            'user_id' => $user->id,
            'display_name' => "User {$suffix}",
            'slug' => "user-{$suffix}-".uniqid(),
            'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
        ]);

        return $user;
    }

    /** Active paid subscription: the row hasActiveSubscription() checks plus the paid payment it requires. */
    protected function grantSubscription(User $user): void
    {
        if (! SubscriptionPlan::query()->where('slug', 'month')->exists()) {
            $this->seed(SubscriptionPlansSeeder::class);
        }
        $planId = (int) SubscriptionPlan::query()->where('slug', 'month')->value('id');
        UserSubscription::query()->create([
            'user_id' => $user->id,
            'plan_id' => $planId,
            'status' => 'active',
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addMonth(),
        ]);
        $this->recordPaidPlanPayment($user, $planId);
    }

    protected function seedListing(User $seller, ListingStatus $status = ListingStatus::Published): Listing
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
            'title' => 'Policy listing',
            'slug' => 'policy-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => $status,
            'published_at' => now(),
        ]);
    }

    protected function seedDeal(User $buyer, User $seller, SafeDealStatus $status = SafeDealStatus::Paid, ?Listing $listing = null): SafeDeal
    {
        $listing ??= $this->seedListing($seller);

        return SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'seller_payout_kopecks' => 95000,
            'currency' => 'RUB',
            'status' => $status,
            'paid_at' => $status === SafeDealStatus::Created ? null : now(),
        ]);
    }

    protected function seedDispute(SafeDeal $deal, User $openedBy): Dispute
    {
        return Dispute::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'opened_by' => $openedBy->id,
            'reason' => 'not_received',
            'status' => DisputeStatus::Open,
        ]);
    }

    protected function seedConversation(User $a, User $b): Conversation
    {
        $conversation = Conversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'type' => ConversationType::Direct,
            'last_message_at' => now(),
        ]);
        foreach ([$a, $b] as $user) {
            ConversationParticipant::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'role' => 'member',
                'joined_at' => now(),
            ]);
        }

        return $conversation;
    }

    protected function seedMessage(Conversation $conversation, User $author, string $body = 'hello'): Message
    {
        return Message::query()->create([
            'uuid' => (string) Str::uuid(),
            'conversation_id' => $conversation->id,
            'user_id' => $author->id,
            'body' => $body,
            'type' => 'text',
            'status' => 'sent',
        ]);
    }

    protected function seedPost(User $author, ContentStatus $status = ContentStatus::Published): Post
    {
        return Post::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $author->id,
            'title' => 'Policy post',
            'body' => 'Body',
            'status' => $status,
            'published_at' => $status === ContentStatus::Published ? now() : null,
        ]);
    }

    protected function seedComment(Post $post, User $author): Comment
    {
        return Comment::query()->create([
            'uuid' => (string) Str::uuid(),
            'commentable_type' => Post::class,
            'commentable_id' => $post->id,
            'user_id' => $author->id,
            'body' => 'Nice',
            'status' => 'published',
            'depth' => 0,
        ]);
    }
}
