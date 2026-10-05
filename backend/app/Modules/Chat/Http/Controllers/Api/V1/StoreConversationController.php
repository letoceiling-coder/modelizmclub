<?php

namespace Modules\Chat\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
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

        /*
         * Отказ должен быть внятным, а не пустым.
         *
         * Голый authorize() отдавал 403 «This action is unauthorized» без
         * кода, и клиент — который для известных кодов открывает окно, а
         * неизвестные показывает тостом — не показывал ничего вовсе. Замер
         * 07.09: пользователь с подтверждённым номером добавляет собеседника
         * в друзья по подсказке «добавьте в друзья, чтобы написать», жмёт
         * «Написать» и не получает ни диалога, ни объяснения.
         *
         * Получателя передаём в политику: с 05.10 переписку открывает дружба
         * либо подписка, и без собеседника решить нельзя. Код отказа
         * различает случаи — `friendship_required` открывает окно «Добавьте
         * в друзья», `subscription_required` окно подписки.
         */
        $verdict = \Illuminate\Support\Facades\Gate::forUser($request->user())
            ->inspect('create', [Conversation::class, $to]);

        if (! $verdict->allowed()) {
            return response()->json([
                'message' => $verdict->message() ?: 'Нельзя начать переписку.',
                'code' => $verdict->code() ?: 'forbidden',
            ], 403);
        }

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
