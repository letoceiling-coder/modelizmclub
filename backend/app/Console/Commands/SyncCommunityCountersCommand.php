<?php

namespace App\Console\Commands;

use App\Models\Community;
use App\Models\Post;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncCommunityCountersCommand extends Command
{
    protected $signature = 'communities:sync-counters {--dry-run : Report drift without writing}';

    protected $description = 'Recompute communities.members_count and posts_count from live rows';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $updated = 0;

        Community::query()->orderBy('id')->each(function (Community $community) use ($dryRun, &$updated): void {
            $liveMembers = (int) DB::table('community_members')
                ->where('community_id', $community->id)
                ->count();
            $livePosts = (int) Post::query()
                ->where('community_id', $community->id)
                ->where('status', 'published')
                ->count();

            if ($community->members_count === $liveMembers && $community->posts_count === $livePosts) {
                return;
            }

            $this->line(sprintf(
                '%s: members %d→%d, posts %d→%d',
                $community->slug,
                $community->members_count,
                $liveMembers,
                $community->posts_count,
                $livePosts,
            ));

            if (! $dryRun) {
                $community->update([
                    'members_count' => $liveMembers,
                    'posts_count' => $livePosts,
                ]);
            }

            $updated++;
        });

        $verb = $dryRun ? 'Would update' : 'Updated';
        $this->info("{$verb} {$updated} communit".($updated === 1 ? 'y' : 'ies').'.');

        return self::SUCCESS;
    }
}
