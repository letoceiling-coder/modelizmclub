<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->check(fn () => DB::select('select 1')),
            'cache' => $this->checkCache(),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json([
            'data' => [
                'status' => $healthy ? 'ok' : 'degraded',
                'service' => 'modelizmclub-api',
                'version' => 'v1',
                'checks' => $checks,
            ],
        ], $healthy ? 200 : 503);
    }

    private function check(callable $probe): bool
    {
        try {
            $probe();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkCache(): bool
    {
        return $this->check(function (): void {
            $key = 'health:'.Str::random(8);
            Cache::put($key, 1, 5);
            Cache::get($key);
            Cache::forget($key);
        });
    }
}
