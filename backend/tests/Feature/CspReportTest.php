<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * Приёмник отчётов CSP открыт без авторизации — значит проверяется не
 * «работает ли», а «нельзя ли им навредить»: что он не требует токена,
 * что не отвечает подробностями и что не пишет в журнал сколько угодно.
 */
class CspReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_accepts_report_from_anonymous_browser(): void
    {
        Log::shouldReceive('channel')->with('csp')->andReturnSelf();
        Log::shouldReceive('info')->once();

        $this->call('POST', '/api/v1/csp-report', [], [], [], [], json_encode([
            'csp-report' => ['violated-directive' => 'script-src', 'blocked-uri' => 'https://evil.example'],
        ]))->assertNoContent();
    }

    public function test_truncates_oversized_reports(): void
    {
        $captured = null;

        Log::shouldReceive('channel')->with('csp')->andReturnSelf();
        Log::shouldReceive('info')->once()->andReturnUsing(function ($message, $context) use (&$captured) {
            $captured = $context;
        });

        // Браузер кладёт в script-sample кусок исходника; на минифицированном
        // бандле это килобайты, и целиком они в журнале не нужны.
        $this->call('POST', '/api/v1/csp-report', [], [], [], [], str_repeat('x', 100_000))
            ->assertNoContent();

        $this->assertIsString($captured['report']);
        $this->assertSame(4096, strlen($captured['report']));
    }

    public function test_empty_body_writes_nothing(): void
    {
        Log::shouldReceive('channel')->never();

        $this->call('POST', '/api/v1/csp-report', [], [], [], [], '')->assertNoContent();
    }
}
