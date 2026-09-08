<?php

namespace Tests\Feature;

use App\Enums\DisputeStatus;
use App\Enums\MediaStatus;
use App\Enums\SafeDealStatus;
use App\Enums\UserRole;
use App\Models\Dispute;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\Media;
use App\Models\SafeDeal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Доступ к вложениям спора через медиа-прокси.
 *
 * До 08.09 файл спора отдавал 403 всем, включая модератора, который по нему
 * решает, кому достанутся деньги: `dispute` не входит в PUBLIC_PURPOSES, а
 * ветки с проверкой прав у прокси не было вовсе.
 */
class DisputeEvidenceAccessTest extends TestCase
{
    use RefreshDatabase;

    private function seedEvidence(): array
    {
        Storage::fake('s3');
        Storage::disk('s3')->put('media/dispute/evidence.png', 'png-bytes');

        $buyer = User::factory()->create();
        $seller = User::factory()->create();

        $category = ListingCategory::query()->create([
            'name' => 'RC',
            'slug' => 'rc-'.uniqid(),
            'sort_order' => 1,
        ]);

        $listing = Listing::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $seller->id,
            'category_id' => $category->id,
            'title' => 'Dispute listing',
            'slug' => 'dispute-'.uniqid(),
            'description' => 'Desc',
            'price_cents' => 100000,
            'currency' => 'RUB',
            'status' => 'published',
            'published_at' => now(),
        ]);

        $deal = SafeDeal::query()->create([
            'uuid' => (string) Str::uuid(),
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount_kopecks' => 100000,
            'platform_fee_kopecks' => 5000,
            'seller_payout_kopecks' => 95000,
            'currency' => 'RUB',
            'status' => SafeDealStatus::Disputed,
            'paid_at' => now(),
        ]);

        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/dispute/evidence.png',
            'filename' => 'evidence.png',
            'mime_type' => 'image/png',
            'size_bytes' => 9,
            'uploaded_by' => $buyer->id,
            'status' => MediaStatus::Ready,
        ]);

        Dispute::query()->create([
            'uuid' => (string) Str::uuid(),
            'safe_deal_id' => $deal->id,
            'opened_by' => $buyer->id,
            'reason' => 'Товар не соответствует описанию',
            'status' => DisputeStatus::Open,
            'evidence' => [[
                'uuid' => $media->uuid,
                'url' => $media->url,
                'filename' => $media->filename,
            ]],
        ]);

        return [$buyer, $seller, $media];
    }

    public function test_anonymous_request_is_refused(): void
    {
        [, , $media] = $this->seedEvidence();

        $this->get('/api/v1/media/'.$media->uuid)->assertStatus(403);
    }

    public function test_outsider_is_refused(): void
    {
        [, , $media] = $this->seedEvidence();
        $stranger = User::factory()->create();

        $this->actingAs($stranger, 'sanctum')
            ->get('/api/v1/media/'.$media->uuid)
            ->assertStatus(403);
    }

    public function test_uploader_sees_own_evidence(): void
    {
        [$buyer, , $media] = $this->seedEvidence();

        $this->actingAs($buyer, 'sanctum')
            ->get('/api/v1/media/'.$media->uuid)
            ->assertStatus(200);
    }

    public function test_counterparty_sees_evidence(): void
    {
        [, $seller, $media] = $this->seedEvidence();

        $this->actingAs($seller, 'sanctum')
            ->get('/api/v1/media/'.$media->uuid)
            ->assertStatus(200);
    }

    public function test_moderator_sees_evidence(): void
    {
        [, , $media] = $this->seedEvidence();
        $moderator = User::factory()->create(['role' => UserRole::Moderator]);

        $this->actingAs($moderator, 'sanctum')
            ->get('/api/v1/media/'.$media->uuid)
            ->assertStatus(200);
    }

    public function test_other_private_purposes_stay_closed(): void
    {
        Storage::fake('s3');
        Storage::disk('s3')->put('media/secret/thing.png', 'bytes');

        $owner = User::factory()->create();
        $media = Media::query()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 's3',
            'path' => 'media/secret/thing.png',
            'filename' => 'thing.png',
            'mime_type' => 'image/png',
            'size_bytes' => 5,
            'uploaded_by' => $owner->id,
            'status' => MediaStatus::Ready,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->get('/api/v1/media/'.$media->uuid)
            ->assertStatus(403);
    }
}
