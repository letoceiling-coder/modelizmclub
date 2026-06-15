<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.version', 'v1');
    }
}
