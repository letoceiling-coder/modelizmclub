<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Modules\Video\Services\VideoService;

class PublishScheduledVideosCommand extends Command
{
    protected $signature = 'videos:publish-scheduled';

    protected $description = 'Publish review videos whose scheduled_at has passed';

    public function handle(VideoService $videos): int
    {
        $count = $videos->publishDueScheduled();
        $this->info("Published {$count} scheduled video(s).");

        return self::SUCCESS;
    }
}
