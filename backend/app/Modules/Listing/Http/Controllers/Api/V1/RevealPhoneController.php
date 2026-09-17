<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Services\SellerPhoneRevealService;

/**
 * Номер продавца по клику. Единственное место, где номер уходит клиенту:
 * ни карточка, ни список его не содержат — только `phone_available`.
 */
class RevealPhoneController extends Controller
{
    public function __invoke(Request $request, string $uuid, SellerPhoneRevealService $reveals): JsonResponse
    {
        $listing = Listing::query()
            ->with('author')
            ->where('uuid', $uuid)
            ->firstOrFail();

        $number = $reveals->reveal($listing, $request->user(), $request);

        return response()->json(['data' => [
            'phone' => $number->phone,
            'expires_at' => $number->expiresAt?->toIso8601String(),
        ]])->header('Cache-Control', 'no-store');
    }
}
