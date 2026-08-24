<?php

namespace Modules\Channel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteChannelController extends Controller
{
    public function __invoke(string $slug, Request $request): JsonResponse
    {
        $channel = $this->findChannel($slug);
        $user = $request->user('sanctum');

        if (! $channel->isOwnedBy($user)) {
            return response()->json(['message' => 'Удалить канал может только владелец.'], 403);
        }

        $data = $request->validate([
            'confirm_name' => ['required', 'string', 'max:60'],
        ]);

        if (trim($data['confirm_name']) !== $channel->name) {
            throw ValidationException::withMessages([
                'confirm_name' => ['Введите точное название канала для подтверждения.'],
            ]);
        }

        $channel->delete();

        return response()->json([
            'data' => ['message' => 'Канал удалён.'],
        ]);
    }

    private function findChannel(string $slug): Channel
    {
        $channel = Channel::query()->where('slug', $slug)->first();

        if (! $channel && Str::isUuid($slug)) {
            $channel = Channel::query()->where('uuid', $slug)->first();
        }

        if (! $channel) {
            throw new NotFoundHttpException('Канал не найден.');
        }

        return $channel;
    }
}
