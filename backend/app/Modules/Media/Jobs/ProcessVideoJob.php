<?php

namespace Modules\Media\Jobs;

use App\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\Media\Services\VideoProcessor;
use Throwable;

/**
 * Сосед ProcessMediaVariantsJob для видео.
 *
 * Живёт в отдельной очереди: ffmpeg считает минутами, а воркер `default`
 * работает с таймаутом 120 с и обслуживает почту, уведомления и рассылку.
 * Очередь и её воркер описаны в deploy/systemd/modelizmclub-media-worker.service.
 */
class ProcessVideoJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;

    public int $backoff = 30;

    public function __construct(public int $mediaId)
    {
        $this->onQueue((string) config('media.video.queue', 'media'));
    }

    /**
     * На двадцать секунд больше, чем даётся самому ffmpeg: иначе очередь
     * снимет задачу ровно в тот момент, когда кодировщик дописывает файл, и
     * в хранилище останется обрезанный mp4.
     */
    public function retryUntil(): \DateTimeInterface
    {
        return now()->addSeconds((int) config('media.video.timeout', 1500) * $this->tries + 20);
    }

    public function handle(VideoProcessor $processor): void
    {
        $media = Media::query()->find($this->mediaId);

        if ($media === null) {
            return;
        }

        $processor->process($media);
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('media_video_job_failed', [
            'media_id' => $this->mediaId,
            'exception' => $exception?->getMessage(),
        ]);

        // Без отметки «нет постера» и «постер не получится» неразличимы, и
        // карточка вечно показывала бы «готовим кадр».
        $media = Media::query()->find($this->mediaId);

        if ($media !== null) {
            VideoProcessor::markFailed($media);
        }
    }
}
