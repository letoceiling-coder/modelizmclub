<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Modules\Media\Services\VoiceTranscriber;

class FeatureFlagsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'communities_enabled' => FeatureFlags::enabled('feature.communities_enabled'),
                'reviews_enabled' => FeatureFlags::enabled('feature.reviews_enabled', true),
                'market_enabled' => FeatureFlags::enabled('feature.market_enabled'),
                'escrow_enabled' => FeatureFlags::enabled('feature.escrow_enabled'),
                'listing_payment_enabled' => FeatureFlags::enabled('feature.listing_payment_enabled'),
                'voice_transcription_enabled' => VoiceTranscriber::available(),
            ],
        ]);
    }
}
