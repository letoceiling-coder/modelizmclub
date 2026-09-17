<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;

/**
 * «Показывать мой номер» — отдельным запросом, а не правкой объявления.
 *
 * Любой PATCH опубликованного объявления возвращает его на модерацию
 * (ListingService::update). Номер в объявлении не виден никому до клика,
 * проверять здесь нечего, а снимать объявление с публикации из-за
 * переключателя было бы наказанием за осторожность.
 */
class ListingPhoneVisibilityController extends Controller
{
    public function __invoke(Request $request, string $uuid): JsonResponse
    {
        $listing = Listing::query()->where('uuid', $uuid)->firstOrFail();

        if ((int) $listing->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Показ номера меняет только автор объявления.'], 403);
        }

        $data = $request->validate(['show_phone' => ['required', 'boolean']]);
        $listing->update(['show_phone' => $data['show_phone']]);

        return response()->json([
            'data' => new ListingResource($listing->fresh(['author.profile.avatar', 'category', 'subcategory', 'city', 'mediaItems.media'])),
        ]);
    }
}
