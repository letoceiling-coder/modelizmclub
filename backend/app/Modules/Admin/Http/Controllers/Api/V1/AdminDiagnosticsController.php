<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

#[Group('Admin — Diagnostics', weight: 95)]
class AdminDiagnosticsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->ok($this->probe(fn () => DB::select('select 1'))),
            'cache' => $this->ok($this->probe(function (): void {
                $key = 'diag:'.Str::random(8);
                Cache::put($key, 1, 5);
                Cache::get($key);
                Cache::forget($key);
            })),
            'queue' => $this->ok($this->probe(fn () => Queue::size())),
        ];

        $vtb = config('billing.vtb');
        $cdekAccount = (string) config('cdek.account');
        $cdekSecure = (string) config('cdek.secure');
        $smsDriver = (string) config('sms.driver', 'iqsms');
        $smsConfigured = $smsDriver === 'log' || $this->smsConfigured($smsDriver);

        $integrations = [
            'billing_provider' => (string) config('billing.provider', 'auto'),
            'vtb_enabled' => (bool) ($vtb['enabled'] ?? false),
            'vtb_configured' => filled($vtb['username'] ?? null) || filled($vtb['token'] ?? null),
            'cdek_enabled' => (bool) config('cdek.enabled'),
            'cdek_configured' => $cdekAccount !== '' && $cdekSecure !== '',
            'sms_driver' => $smsDriver,
            'sms_configured' => $smsConfigured,
        ];

        $healthy = ! in_array(false, array_column($checks, 'ok'), true);

        return response()->json([
            'data' => [
                'status' => $healthy ? 'ok' : 'degraded',
                'app' => [
                    'name' => (string) config('app.name'),
                    'env' => app()->environment(),
                    'laravel' => app()->version(),
                    'php' => PHP_VERSION,
                ],
                'checks' => $checks,
                'integrations' => $integrations,
            ],
        ]);
    }

    private function probe(callable $fn): bool
    {
        try {
            $fn();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    /** @return array{ok: bool} */
    private function ok(bool $ok): array
    {
        return ['ok' => $ok];
    }

    /**
     * Настроен ли шлюз — спрашиваем сам драйвер.
     *
     * Здесь стоял свой список драйверов по именам с откатом к iqsms:
     * у незнакомого драйвера с пустыми доступами страница показывала
     * «настроен: да», глядя на чужие ключи. Неизвестное имя теперь
     * честно отвечает «нет», а не проваливается в первый попавшийся.
     */
    private function smsConfigured(string $driver): bool
    {
        $реестр = (array) config('sms.drivers', []);
        if (! isset($реестр[$driver])) {
            return false;
        }

        try {
            return app($реестр[$driver])->isConfigured();
        } catch (\Throwable) {
            // Класса нет или он не тот — это «не настроен», а не 500 на
            // странице диагностики, которую открывают именно тогда,
            // когда что-то сломалось.
            return false;
        }
    }
}
