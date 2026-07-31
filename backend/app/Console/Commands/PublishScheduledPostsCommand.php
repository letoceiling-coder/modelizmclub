<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Feed\Services\PostService;

class PublishScheduledPostsCommand extends Command
{
    protected $signature = 'posts:publish-scheduled';

    protected $description = 'Publish feed posts whose scheduled time has arrived';

    public function handle(PostService $posts): int
    {
        $count = $posts->publishDueScheduledPosts();

        if ($count > 0) {
            $this->info("Published {$count} scheduled post(s).");
        }

        return self::SUCCESS;
    }
}
