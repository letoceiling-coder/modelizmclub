<?php

namespace App\Console\Commands;

use App\Models\Post;
use Illuminate\Console\Command;

class CleanupSmokePostsCommand extends Command
{
    protected $signature = 'posts:cleanup-smoke {--dry-run : List matches without deleting}';

    protected $description = 'Remove throwaway SMOKE* posts created by deploy smoke tests';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $query = Post::query()
            ->where(function ($q): void {
                $q->where('title', 'like', 'SMOKE %')
                    ->orWhere('body', 'like', 'smoke %');
            });

        $count = $query->count();

        if ($count === 0) {
            $this->info('No SMOKE test posts found.');

            return self::SUCCESS;
        }

        $query->orderBy('id')->each(function (Post $post) use ($dryRun): void {
            $this->line(sprintf(
                '%s [%s] %s — %s',
                $post->uuid,
                $post->status->value ?? (string) $post->status,
                $post->title,
                $dryRun ? 'would delete' : 'deleted',
            ));

            if (! $dryRun) {
                $post->delete();
            }
        });

        $verb = $dryRun ? 'Would remove' : 'Removed';
        $this->info("{$verb} {$count} SMOKE post(s).");

        return self::SUCCESS;
    }
}
