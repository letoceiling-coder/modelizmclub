<?php

namespace Tests\Unit;

use App\Enums\ContentStatus;
use App\Models\Post;
use Modules\Feed\Support\PostInteractionRules;
use PHPUnit\Framework\TestCase;

class PostInteractionRulesTest extends TestCase
{
    public function test_only_published_posts_allow_public_interactions(): void
    {
        $post = new Post(['status' => ContentStatus::Published]);
        $this->assertTrue(PostInteractionRules::allowsPublicInteractions($post));

        foreach ([
            ContentStatus::PendingModeration,
            ContentStatus::Draft,
            ContentStatus::Scheduled,
            ContentStatus::Rejected,
        ] as $status) {
            $blocked = new Post(['status' => $status]);
            $this->assertFalse(PostInteractionRules::allowsPublicInteractions($blocked));
        }
    }
}
