<?php

namespace Tests\Unit;

use App\Support\FeedGuestAccessRegistry;
use PHPUnit\Framework\TestCase;

class FeedGuestAccessRegistryTest extends TestCase
{
    public function test_legacy_allowed_true_maps_to_guest(): void
    {
        $normalized = FeedGuestAccessRegistry::normalizeAction(
            ['allowed' => true, 'deny_mode' => 'inherit'],
            'auth',
        );

        $this->assertSame('guest', $normalized['min_tier']);
        $this->assertTrue($normalized['allowed']);
    }

    public function test_legacy_allowed_false_keeps_non_guest_default(): void
    {
        $normalized = FeedGuestAccessRegistry::normalizeAction(
            ['allowed' => false],
            'subscription',
        );

        $this->assertSame('subscription', $normalized['min_tier']);
        $this->assertFalse($normalized['allowed']);
    }

    public function test_legacy_allowed_false_on_guest_default_becomes_auth(): void
    {
        $normalized = FeedGuestAccessRegistry::normalizeAction(
            ['allowed' => false],
            'guest',
        );

        $this->assertSame('auth', $normalized['min_tier']);
        $this->assertFalse($normalized['allowed']);
    }

    public function test_explicit_min_tier_wins_over_allowed(): void
    {
        $normalized = FeedGuestAccessRegistry::normalizeAction(
            ['allowed' => true, 'min_tier' => 'subscription'],
            'guest',
        );

        $this->assertSame('subscription', $normalized['min_tier']);
        $this->assertFalse($normalized['allowed']);
    }

    public function test_default_config_includes_route_feed_and_version_two(): void
    {
        $config = FeedGuestAccessRegistry::defaultConfig();

        $this->assertSame(2, $config['version']);
        $this->assertSame('guest', $config['actions']['route.feed']['min_tier']);
        $this->assertSame('auth', $config['actions']['route.reviews']['min_tier']);
        $this->assertSame('subscription', $config['actions']['feed.compose.open']['min_tier']);
        $this->assertSame('auth', $config['actions']['ads.write_seller']['min_tier']);
        $this->assertSame('auth', $config['actions']['messenger.send']['min_tier']);
        $this->assertTrue($config['actions']['feed.filter.all']['allowed']);
        $this->assertFalse($config['actions']['feed.filter.following']['allowed']);
    }
}
