<?php

namespace Modules\Chat\Http\Controllers\Api\V1\Concerns;

use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Проверка права писать в беседу с внятным отказом.
 *
 * Голый authorize() превращает отказ политики в 403 без кода, и клиент
 * показывает его текст тостом. Отказ по подписке возвращается с кодом
 * `subscription_required` — по нему клиент открывает окно подписки, как и в
 * StoreConversationController. Прочие отказы (не участник) остаются прежними.
 */
trait AuthorizesSend
{
    protected function denySend(Request $request, Conversation $conversation): ?JsonResponse
    {
        $verdict = Gate::forUser($request->user())->inspect('send', $conversation);

        if ($verdict->allowed()) {
            return null;
        }

        if ($verdict->code() === 'subscription_required') {
            return response()->json([
                'message' => $verdict->message(),
                'code' => 'subscription_required',
            ], 403);
        }

        $verdict->authorize();

        return null;
    }
}
