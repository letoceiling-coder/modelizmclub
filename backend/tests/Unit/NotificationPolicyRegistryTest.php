<?php

namespace Tests\Unit;

use App\Support\NotificationPolicyRegistry;
use PHPUnit\Framework\TestCase;

class NotificationPolicyRegistryTest extends TestCase
{
    public function test_aliases_map_onto_registry_keys(): void
    {
        $this->assertSame('friend_requests', NotificationPolicyRegistry::mapType('friend_request'));
        $this->assertSame('friend_requests', NotificationPolicyRegistry::mapType('friend_accept'));
        $this->assertSame('comments', NotificationPolicyRegistry::mapType('comment'));
        $this->assertSame('likes', NotificationPolicyRegistry::mapType('like'));
        $this->assertSame('messages', NotificationPolicyRegistry::mapType('message'));
        $this->assertSame('promo', NotificationPolicyRegistry::mapType('system'));
        $this->assertNull(NotificationPolicyRegistry::mapType('email_code'));
    }

    public function test_transactional_types_are_not_user_toggleable_by_default(): void
    {
        $byKey = NotificationPolicyRegistry::typesByKey();

        $this->assertFalse($byKey['moderation']['default_user_can_toggle']);
        $this->assertFalse($byKey['listings']['default_user_can_toggle']);
        $this->assertFalse($byKey['deals']['default_user_can_toggle']);
        $this->assertFalse($byKey['report']['show_in_cabinet']);
        $this->assertTrue($byKey['comments']['default_user_can_toggle']);
        $this->assertSame('verified', $byKey['promo']['default_min_tier']);
    }
}
