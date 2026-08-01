<?php

namespace Tests\Unit;

use Modules\Feed\Support\PostFormRules;
use PHPUnit\Framework\TestCase;

class PostFormRulesTest extends TestCase
{
    public function test_title_max_length_is_100(): void
    {
        $this->assertSame(100, PostFormRules::TITLE_MAX_LENGTH);
    }

    public function test_title_max_validation_message_mentions_limit(): void
    {
        $messages = PostFormRules::messages();
        $this->assertStringContainsString('100', $messages['title.max']);
    }
}
