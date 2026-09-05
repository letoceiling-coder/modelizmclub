<?php

namespace App\Console\Commands;

use App\Enums\MediaStatus;
use App\Models\Media;
use Illuminate\Console\Command;
use Modules\Media\Jobs\ProcessVideoJob;
use Modules\Media\Services\VideoProcessor;

/**
 * Догоняет ролики, загруженные до появления конвейера: у них нет ни постера,
 * ни облегчённой копии, ни даже ширины с высотой в базе.
 *
 * Сосед media:rebuild-variants, только для видео.
 */
class RebuildVideoRenditionsCommand extends Command
{
    protected $signature = 'media:rebuild-videos {--limit=50 : Сколько роликов поставить в очередь} {--force : Взять и те, у которых постер уже есть}';

    protected $description = 'Ставит в очередь постер и копию 720p для готовых видео';

    public function handle(VideoProcessor $processor): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $force = (bool) $this->option('force');
        $queued = 0;

        $query = Media::query()
            ->where('status', MediaStatus::Ready)
            ->where('mime_type', 'like', 'video/%')
            ->orderBy('id')
            ->limit($limit);

        if (! $force) {
            $query->missingVariants();
        }

        foreach ($query->get() as $media) {
            if (! $processor->shouldProcess($media)) {
                continue;
            }

            ProcessVideoJob::dispatch($media->id);
            $queued++;
        }

        $this->info("В очередь поставлено роликов: {$queued}.");

        return self::SUCCESS;
    }
}
