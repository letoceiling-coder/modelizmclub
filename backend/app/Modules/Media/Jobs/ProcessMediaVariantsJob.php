<?php

namespace Modules\Media\Jobs;

use App\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\Media\Services\MediaVariantProcessor;
use Throwable;

class ProcessMediaVariantsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $timeout = 120;

    public int $tries = 2;

    public int $backoff = 10;

    public function __construct(public int $mediaId) {}

    public function handle(MediaVariantProcessor $processor): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null) {
            return;
        }

        $processor->process($media);
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('media_variants_failed', [
            'media_id' => $this->mediaId,
            'exception' => $exception?->getMessage(),
        ]);
    }
}
