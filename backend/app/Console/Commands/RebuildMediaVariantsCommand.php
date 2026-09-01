<?php

namespace App\Console\Commands;

use App\Enums\MediaStatus;
use App\Models\Media;
use Illuminate\Console\Command;
use Modules\Media\Jobs\ProcessMediaVariantsJob;
use Modules\Media\Services\MediaVariantProcessor;

class RebuildMediaVariantsCommand extends Command
{
    protected $signature = 'media:rebuild-variants {--limit=200 : Max rows to queue}';

    protected $description = 'Queue display-variant rebuilds for ready images that have none';

    public function handle(MediaVariantProcessor $processor): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $queued = 0;

        $rows = Media::query()
            ->where('status', MediaStatus::Ready)
            ->where(function ($query): void {
                $query->whereNull('variants')->orWhere('variants', '[]');
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($rows as $media) {
            if (! $processor->shouldProcess($media)) {
                continue;
            }

            ProcessMediaVariantsJob::dispatch($media->id);
            $queued++;
        }

        $this->info("Queued {$queued} media variant job(s).");

        return self::SUCCESS;
    }
}
