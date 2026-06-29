<?php

namespace Modules\Call\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClientLog;
use Carbon\CarbonImmutable;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Calls', weight: 36)]
class ClientLogController extends Controller
{
    /**
     * Ingest a batch of client-side diagnostic logs (WebRTC / call stability).
     * Buffered in the browser localStorage and flushed periodically.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => ['nullable', 'string', 'max:64'],
            'device' => ['nullable', 'array'],
            'device.platform' => ['nullable', 'string', 'max:32'],
            'device.os' => ['nullable', 'string', 'max:64'],
            'device.browser' => ['nullable', 'string', 'max:64'],
            'device.device' => ['nullable', 'string', 'max:64'],
            'device.network' => ['nullable', 'string', 'max:32'],
            'device.user_agent' => ['nullable', 'string', 'max:512'],
            'entries' => ['required', 'array', 'max:500'],
            'entries.*.id' => ['nullable', 'string', 'max:64'],
            'entries.*.t' => ['nullable', 'numeric'],
            'entries.*.level' => ['nullable', 'string', 'max:16'],
            'entries.*.tag' => ['nullable', 'string', 'max:32'],
            'entries.*.msg' => ['nullable', 'string', 'max:2000'],
            'entries.*.call_uuid' => ['nullable', 'string', 'max:64'],
            'entries.*.data' => ['nullable'],
        ]);

        $userId = $request->user()?->id;
        $sessionId = $data['session_id'] ?? null;
        $device = $data['device'] ?? [];
        $now = CarbonImmutable::now();

        $rows = [];
        $seen = [];
        foreach ($data['entries'] as $e) {
            $clientTime = isset($e['t']) ? CarbonImmutable::createFromTimestampMs((int) $e['t']) : null;
            $context = $e['data'] ?? null;
            $clientId = isset($e['id']) ? (string) $e['id'] : null;

            // Drop in-batch duplicates so the unique index never rejects the whole insert.
            if ($clientId !== null) {
                if (isset($seen[$clientId])) {
                    continue;
                }
                $seen[$clientId] = true;
            }

            $rows[] = [
                'user_id' => $userId,
                'client_id' => $clientId,
                'session_id' => $sessionId,
                'call_uuid' => isset($e['call_uuid']) ? (string) $e['call_uuid'] : null,
                'platform' => $device['platform'] ?? null,
                'os' => $device['os'] ?? null,
                'browser' => $device['browser'] ?? null,
                'device' => $device['device'] ?? null,
                'network' => $device['network'] ?? null,
                'user_agent' => isset($device['user_agent']) ? mb_substr((string) $device['user_agent'], 0, 512) : null,
                'level' => $e['level'] ?? 'info',
                'tag' => $e['tag'] ?? 'app',
                'message' => isset($e['msg']) ? mb_substr((string) $e['msg'], 0, 2000) : null,
                'context' => $context !== null ? json_encode($context, JSON_UNESCAPED_UNICODE) : null,
                'client_time' => $clientTime,
                'created_at' => $now,
            ];
        }

        if ($rows !== []) {
            // Idempotent: a re-sent batch (failed flush retry, second tab) is
            // skipped on the client_id unique index instead of duplicated.
            ClientLog::query()->insertOrIgnore($rows);
        }

        return response()->json(['data' => ['stored' => count($rows)]]);
    }
}
