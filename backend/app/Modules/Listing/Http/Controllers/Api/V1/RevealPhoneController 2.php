<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class RevealPhoneController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $key = 'reveal-phone:'.$user->id;

        if (RateLimiter::tooManyAttempts($key, 20)) {
            abort(429, 'Слишком много запросов.');
        }

        RateLimiter::hit($key, 3600);

        $listing = Listing::query()
            ->with('author')
            ->where('uuid', $uuid)
            ->firstOrFail();

        $phone = $listing->author?->phone;

        if (! $phone) {
            return response()->json(['message' => 'Номер недоступен.'], 404);
        }

        return response()->json(['data' => ['phone' => $phone]]);
    }
}
