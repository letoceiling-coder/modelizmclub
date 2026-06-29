<?php

namespace Modules\Call\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Call\Services\CallSignaling;
use Modules\Call\Services\LiveKitToken;

#[Group('Calls', weight: 36)]
class LiveKitController extends Controller
{
    /**
     * Issue a LiveKit access token for joining a group-call room.
     */
    public function token(Request $request): JsonResponse
    {
        $data = $request->validate([
            'room' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9_\-]+$/'],
        ]);

        $url = (string) config('livekit.url');
        if ($url === '' || config('livekit.api_key') === '' || config('livekit.api_secret') === '') {
            return response()->json(['message' => 'Групповые звонки не настроены.'], 503);
        }

        $user = $request->user();
        $identity = (string) $user->uuid;
        $name = $user->profile?->display_name ?? $user->name ?? 'Пользователь';

        $token = LiveKitToken::create(
            $identity,
            $name,
            ['room' => $data['room']],
            (int) config('livekit.token_ttl', 21600),
        );

        return response()->json([
            'data' => [
                'url' => $url,
                'token' => $token,
                'room' => $data['room'],
                'identity' => $identity,
            ],
        ]);
    }

    /**
     * Invite users to a group-call room (push a realtime ring to each).
     */
    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'room' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9_\-]+$/'],
            'to' => ['required', 'array', 'min:1', 'max:16'],
            'to.*' => ['string'],
            'media' => ['sometimes', Rule::in(['audio', 'video'])],
            'title' => ['sometimes', 'string', 'max:120'],
        ]);

        $caller = $request->user();
        $from = [
            'uuid' => $caller->uuid,
            'name' => $caller->profile?->display_name ?? $caller->name ?? 'Пользователь',
            'avatar' => $caller->profile?->avatar?->url,
        ];

        $invitees = User::query()
            ->whereIn('uuid', $data['to'])
            ->where('id', '!=', $caller->id)
            ->pluck('uuid');

        foreach ($invitees as $uuid) {
            CallSignaling::send((string) $uuid, 'group_invite', [
                'room' => $data['room'],
                'media' => $data['media'] ?? 'video',
                'title' => $data['title'] ?? null,
                'from' => $from,
            ]);
        }

        return response()->json(['data' => ['invited' => $invitees->count()]]);
    }
}
