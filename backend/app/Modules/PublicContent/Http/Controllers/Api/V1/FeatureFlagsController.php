<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;

class FeatureFlagsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $flags = SystemSetting::query()
            ->whereIn('key', [
                'feature.communities_enabled',
                'feature.market_enabled',
                'feature.escrow_enabled',
                'feature.listing_payment_enabled',
            ])
            ->get()
            ->keyBy('key');

        $enabled = fn (string $key): bool => (bool) ($flags->get($key)?->value['enabled'] ?? false);

        return response()->json([
            'data' => [
                'communities_enabled' => $enabled('feature.communities_enabled'),
                // Traffic is meant to go to listings, not be split across an
                // external marketplace link — off by default, toggleable from
                // /admin without a frontend deploy.
                'market_enabled' => $enabled('feature.market_enabled'),
                // «Безопасная сделка» badge on listings — only honest once
                // YooKassa escrow is actually wired up; off by default.
                'escrow_enabled' => $enabled('feature.escrow_enabled'),
                // Paid listing placement — off by default so ads publish for free
                // until billing is fully wired in the create-ad wizard.
                'listing_payment_enabled' => $enabled('feature.listing_payment_enabled'),
            ],
        ]);
    }
}
