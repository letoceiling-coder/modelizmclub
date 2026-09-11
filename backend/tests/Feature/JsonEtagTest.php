<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ETag на JSON-ответах API. Проверяется не только «заголовок есть», но и то,
 * что 304 срабатывает на слабую форму: nginx ослабляет ETag при сжатии, и
 * браузер присылает назад именно её. Без этого ETag стоял бы в ответах, а
 * 304 не случался бы никогда — снаружи это выглядело бы как работающая
 * правка.
 */
class JsonEtagTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_json_carries_an_etag(): void
    {
        $response = $this->getJson('/api/v1/public/bootstrap');

        $response->assertOk();
        $this->assertMatchesRegularExpression('/^"[0-9a-f]{32}"$/', (string) $response->headers->get('ETag'));
    }

    public function test_matching_if_none_match_returns_304_without_body(): void
    {
        $etag = (string) $this->getJson('/api/v1/public/bootstrap')->headers->get('ETag');

        $response = $this->getJson('/api/v1/public/bootstrap', ['If-None-Match' => $etag]);

        $response->assertStatus(304);
        $this->assertSame('', $response->getContent());
    }

    public function test_weak_etag_sent_back_after_gzip_still_matches(): void
    {
        $etag = (string) $this->getJson('/api/v1/public/bootstrap')->headers->get('ETag');

        $response = $this->getJson('/api/v1/public/bootstrap', ['If-None-Match' => 'W/'.$etag]);

        $response->assertStatus(304);
    }

    public function test_stale_etag_gets_the_full_body(): void
    {
        $response = $this->getJson('/api/v1/public/bootstrap', ['If-None-Match' => '"00000000000000000000000000000000"']);

        $response->assertOk();
        $this->assertNotSame('', $response->getContent());
    }

    public function test_errors_are_not_turned_into_304(): void
    {
        $first = $this->getJson('/api/v1/listings/00000000-0000-0000-0000-000000000000');
        $first->assertNotFound();

        $this->assertNull($first->headers->get('ETag'));
    }

    public function test_writes_get_no_etag(): void
    {
        $response = $this->postJson('/api/v1/csp-report', []);

        $this->assertNull($response->headers->get('ETag'));
    }
}
