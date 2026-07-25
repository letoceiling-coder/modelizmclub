<?php

namespace App\Console\Commands;

use App\Enums\CommunityMemberRole;
use App\Models\Community;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncCommunityOwnersCommand extends Command
{
    protected $signature = 'communities:sync-owners';

    protected $description = 'Sync communities.created_by from community_members with owner role';

    public function handle(): int
    {
        $rows = DB::table('community_members')
            ->where('role', CommunityMemberRole::Owner->value)
            ->orderBy('community_id')
            ->get(['community_id', 'user_id']);

        $updated = 0;

        foreach ($rows as $row) {
            $changed = Community::query()
                ->whereKey($row->community_id)
                ->where(function ($q) use ($row): void {
                    $q->whereNull('created_by')
                        ->orWhere('created_by', '!=', $row->user_id);
                })
                ->update(['created_by' => $row->user_id]);

            $updated += $changed;
        }

        $this->info("Updated {$updated} communit".($updated === 1 ? 'y' : 'ies').'.');

        return self::SUCCESS;
    }
}
