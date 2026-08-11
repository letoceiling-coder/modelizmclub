<?php

/**
 * Ensures a published listing from a non-demo seller exists for VTB escrow smoke tests.
 */
require __DIR__.'/../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Support\Str;

$demoEmail = 'demo@modelizmclub.ru';
$sellerEmail = 'escrow-seller@modelizmclub.ru';

$seller = User::query()->where('email', $sellerEmail)->first();

if (! $seller) {
    $seller = User::factory()->create([
        'email' => $sellerEmail,
        'status' => UserStatus::Active,
    ]);

    UserProfile::query()->create([
        'user_id' => $seller->id,
        'display_name' => 'Escrow Test Seller',
        'slug' => 'escrow-test-seller',
        'privacy_settings' => UserProfile::DEFAULT_PRIVACY,
    ]);

    echo "Created seller {$sellerEmail}\n";
}

$category = ListingCategory::query()->firstOrCreate(
    ['slug' => 'escrow-smoke'],
    ['name' => 'Escrow smoke', 'sort_order' => 999],
);

$listing = Listing::query()
    ->where('user_id', $seller->id)
    ->where('status', ListingStatus::Published)
    ->where('price_cents', '>', 0)
    ->first();

if (! $listing) {
    $listing = Listing::query()->create([
        'uuid' => (string) Str::uuid(),
        'user_id' => $seller->id,
        'category_id' => $category->id,
        'title' => 'VTB Escrow smoke listing',
        'slug' => 'vtb-escrow-smoke-'.Str::lower(Str::random(6)),
        'description' => 'Test listing for VTB sandbox escrow checkout.',
        'price_cents' => 150000,
        'currency' => 'RUB',
        'status' => ListingStatus::Published,
        'published_at' => now(),
    ]);

    echo "Created listing {$listing->uuid}\n";
} else {
    echo "Existing listing {$listing->uuid}\n";
}

$demo = User::query()->where('email', $demoEmail)->value('id');
echo json_encode([
    'seller_id' => $seller->id,
    'listing_uuid' => $listing->uuid,
    'demo_user_id' => $demo,
    'price_cents' => $listing->price_cents,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";
