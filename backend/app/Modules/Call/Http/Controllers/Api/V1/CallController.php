<?php

namespace Modules\Call\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Call\Events\CallSignal;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Group('Calls', weight: 36)]
class CallController extends Controller
{
    /**
     * ICE servers (STUN + ephemeral TURN credentials) for the WebRTC client.
     */
    public function iceServers(Request $request): JsonResponse
    {
        $servers = [];

        foreach ((array) config('calls.stun', []) as $stun) {
            $servers[] = ['urls' => $stun];
        }

        $turnUrls = (array) config('calls.turn.urls', []);
        $secret = config('calls.turn.secret');

        if ($turnUrls !== [] && is_string($secret) && $secret !== '') {
            $ttl = (int) config('calls.turn.ttl', 3600);
            $username = (time() + $ttl).':'.$request->user()->id;
            $credential = base64_encode(hash_hmac('sha1', $username, $secret, true));

            $servers[] = [
                'urls' => array_values($turnUrls),
                'username' => $username,
                'credential' => $credential,
            ];
        }

        return response()->json(['data' => ['ice_servers' => $servers]]);
    }

    /**
     * Start a call: persist the log and push the SDP offer to the callee.
     */
    public function initiate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => ['required', 'string'],
            'media' => ['required', Rule::in(['audio', 'video'])],
            'sdp' => ['required', 'array'],
        ]);

        $caller = $request->user();
        $callee = User::query()->where('uuid', $data['to'])->first();

        if (! $callee || $callee->id === $caller->id) {
            throw new NotFoundHttpException('Получатель не найден.');
        }

        $call = CallLog::create([
            'caller_id' => $caller->id,
            'callee_id' => $callee->id,
            'media' => $data['media'],
            'status' => 'ringing',
            'started_at' => now(),
        ]);

        broadcast(new CallSignal($callee->uuid, 'offer', [
            'call_uuid' => $call->uuid,
            'media' => $data['media'],
            'sdp' => $data['sdp'],
            'from' => $this->userPayload($caller),
        ]));

        return response()->json(['data' => ['call_uuid' => $call->uuid]], 201);
    }

    public function answer(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate(['sdp' => ['required', 'array']]);
        $call = $this->findCall($uuid, $request->user());

        $call->update(['status' => 'answered', 'answered_at' => now()]);

        broadcast(new CallSignal($call->caller->uuid, 'answer', [
            'call_uuid' => $call->uuid,
            'sdp' => $data['sdp'],
        ]));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function ice(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate(['candidate' => ['required', 'array']]);
        $call = $this->findCall($uuid, $request->user());

        broadcast(new CallSignal($this->peerUuid($call, $request->user()), 'ice', [
            'call_uuid' => $call->uuid,
            'candidate' => $data['candidate'],
        ]));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function reject(Request $request, string $uuid): JsonResponse
    {
        $call = $this->findCall($uuid, $request->user());

        if (in_array($call->status, ['ringing'], true)) {
            $call->update(['status' => 'rejected', 'ended_at' => now()]);
        }

        broadcast(new CallSignal($this->peerUuid($call, $request->user()), 'reject', [
            'call_uuid' => $call->uuid,
        ]));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function hangup(Request $request, string $uuid): JsonResponse
    {
        $call = $this->findCall($uuid, $request->user());

        if (! in_array($call->status, ['ended', 'rejected', 'missed'], true)) {
            $duration = $call->answered_at ? max(0, now()->diffInSeconds($call->answered_at)) : 0;
            $call->update([
                'status' => $call->answered_at ? 'ended' : 'missed',
                'ended_at' => now(),
                'duration_seconds' => $duration,
            ]);
        }

        broadcast(new CallSignal($this->peerUuid($call, $request->user()), 'hangup', [
            'call_uuid' => $call->uuid,
        ]));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function history(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $calls = CallLog::query()
            ->with(['caller.profile.avatar', 'callee.profile.avatar'])
            ->where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(function (CallLog $call) use ($userId): array {
                $outgoing = $call->caller_id === $userId;
                $peer = $outgoing ? $call->callee : $call->caller;

                return [
                    'uuid' => $call->uuid,
                    'direction' => $outgoing ? 'outgoing' : 'incoming',
                    'media' => $call->media,
                    'status' => $call->status,
                    'duration' => $call->duration_seconds,
                    'started_at' => $call->started_at?->toIso8601String() ?? $call->created_at->toIso8601String(),
                    'peer' => $this->userPayload($peer),
                ];
            });

        return response()->json(['data' => $calls]);
    }

    private function findCall(string $uuid, User $user): CallLog
    {
        $call = CallLog::query()->where('uuid', $uuid)->first();

        if (! $call || ($call->caller_id !== $user->id && $call->callee_id !== $user->id)) {
            throw new NotFoundHttpException('Звонок не найден.');
        }

        return $call;
    }

    private function peerUuid(CallLog $call, User $user): string
    {
        $peerId = $call->caller_id === $user->id ? $call->callee_id : $call->caller_id;

        return (string) User::query()->whereKey($peerId)->value('uuid');
    }

    /** @return array<string, mixed> */
    private function userPayload(?User $user): array
    {
        if (! $user) {
            return ['uuid' => '', 'name' => 'Пользователь', 'avatar' => null];
        }

        $user->loadMissing('profile.avatar');

        return [
            'uuid' => $user->uuid,
            'name' => $user->profile?->display_name ?? $user->name ?? 'Пользователь',
            'avatar' => $user->profile?->avatar?->url,
        ];
    }
}
