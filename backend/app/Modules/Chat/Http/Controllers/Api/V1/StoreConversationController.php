<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Chat\Http\Resources\ConversationResource;
use Modules\Chat\Services\ChatService;

class StoreConversationController extends Controller
{
    public function __invoke(Request $request, ChatService $chat): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'listing_uuid' => ['nullable', 'string', 'uuid'],
            'listing_id' => ['nullable'],
        ]);

        $to = User::query()->findOrFail($data['user_id']);
        $listing = $this->resolveListing($data);

        $conversation = $chat->findOrCreateDirect($request->user(), $to, $listing);

        return response()->json([
            'data' => new ConversationResource($conversation),
        ], 201);
    }

    /** @param  array<string, mixed>  $data */
    private function resolveListing(array $data): ?Listing
    {
        if (! empty($data['listing_uuid'])) {
            return Listing::query()->where('uuid', $data['listing_uuid'])->first();
        }

        if (! array_key_exists('listing_id', $data) || $data['listing_id'] === null || $data['listing_id'] === '') {
            return null;
        }

        $listingId = $data['listing_id'];

        if (is_numeric($listingId)) {
            return Listing::query()->find((int) $listingId);
        }

        return Listing::query()->where('uuid', (string) $listingId)->first();
    }
}
