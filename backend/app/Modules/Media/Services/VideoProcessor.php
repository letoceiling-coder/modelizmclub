<?php

namespace Modules\Media\Services;

use App\Models\Media;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Постер и облегчённая копия видео — то же место в конвейере, что
 * MediaVariantProcessor занимает для картинок, но кодирует ffmpeg.
 *
 * Зачем: лента отдавала исходник. Замер 05.09 на проде — один ролик 14,1 МБ,
 * браузер выкачивал 140 КБ заголовков и первых кадров ещё до нажатия play,
 * а на медленном канале и без `preload="none"` — все четырнадцать. При этом
 * ни ширины, ни высоты, ни длительности в базе не было: карточка не могла
 * даже зарезервировать место под кадр.
 *
 * Результат складывается в ту же колонку `variants`, что и у картинок, но в
 * слоты `poster` и `720p`. Отдаёт их тот же ServeMediaController.
 */
class VideoProcessor
{
    public const POSTER = 'poster';

    /** Слот-отметка о том, что задача упала: иначе «нет постера» и «постер не сделать» неразличимы. */
    public const FAILED = 'video_failed';

    public function process(Media $media): void
    {
        if (! config('media.video.enabled', true)) {
            return;
        }

        if (! $this->shouldProcess($media)) {
            return;
        }

        if (! $this->binariesAvailable()) {
            Log::warning('media_video_skipped', [
                'media_uuid' => $media->uuid,
                'reason' => 'ffmpeg_missing',
            ]);

            return;
        }

        $max = (int) config('media.video.max_source_bytes');
        $size = (int) ($media->size_bytes ?? 0);

        if ($max > 0 && $size > $max) {
            Log::warning('media_video_skipped', [
                'media_uuid' => $media->uuid,
                'reason' => 'too_large',
                'bytes' => $size,
            ]);

            return;
        }

        $tmp = $this->downloadToTemp($media);

        if ($tmp === null) {
            return;
        }

        try {
            $probe = $this->probe($tmp);

            if ($probe === null) {
                Log::warning('media_video_skipped', [
                    'media_uuid' => $media->uuid,
                    'reason' => 'probe_failed',
                ]);

                return;
            }

            // Размеры и длительность — половина пользы от этой задачи: без них
            // карточка не знает пропорций кадра и резервирует место наугад.
            $media->width = $probe['width'];
            $media->height = $probe['height'];
            $media->duration_seconds = $probe['duration'] > 0 ? (int) round($probe['duration']) : null;

            $dir = $this->variantDirectory($media);
            $variants = is_array($media->variants) ? $media->variants : [];
            // Повторный заход снимает отметку о прошлой неудаче.
            unset($variants[self::FAILED]);

            $poster = $this->makePoster($media, $tmp, $dir, $probe);

            if ($poster !== null) {
                $variants[self::POSTER] = ['webp' => $poster];
            }

            $rendition = $this->makeRendition($media, $tmp, $dir, $probe);

            if ($rendition !== null) {
                $variants[$this->renditionName()] = ['mp4' => $rendition];
            }

            $media->variants = $variants === [] ? null : $variants;
            $media->save();
        } catch (Throwable $e) {
            Log::error('media_video_failed', [
                'media_uuid' => $media->uuid,
                'exception' => $e->getMessage(),
            ]);

            throw $e;
        } finally {
            @unlink($tmp);
        }
    }

    public function shouldProcess(Media $media): bool
    {
        return str_starts_with((string) $media->mime_type, 'video/');
    }

    public function renditionName(): string
    {
        return (string) config('media.video.rendition.name', '720p');
    }

    /**
     * Постер и облегчённая копия для API. Пустой массив — задача ещё не
     * отработала или отработала вхолостую; вызывающий код показывает
     * оригинал, как показывал раньше.
     *
     * @return array{poster?: string, sources?: array<int, array{quality: string, url: string, bytes: int}>}
     */
    public static function publicVideo(Media $media): array
    {
        if (! str_starts_with((string) $media->mime_type, 'video/')) {
            return [];
        }

        $stored = is_array($media->variants) ? $media->variants : [];
        $out = [];

        if (! empty($stored[self::POSTER]['webp']['path'])) {
            $out['poster'] = $media->variantPublicUrl(self::POSTER, 'webp');
        }

        $name = (string) config('media.video.rendition.name', '720p');

        if (! empty($stored[$name]['mp4']['path'])) {
            $out['sources'] = [[
                'quality' => $name,
                'url' => $media->variantPublicUrl($name, 'mp4'),
                'bytes' => (int) ($stored[$name]['mp4']['bytes'] ?? 0),
            ]];
        }

        // Ролик играется с первой секунды — обработка идёт только за постером и
        // облегчённой копией. Поэтому «processing» здесь не запрещает
        // воспроизведение, а объясняет, почему на месте кадра пока заглушка.
        $out['status'] = match (true) {
            ! empty($stored[self::FAILED]) => 'failed',
            isset($out['poster']) => 'ready',
            default => 'processing',
        };

        return $out;
    }

    /**
     * Отметить, что конвейер сдался. Задача вызывает это из failed().
     */
    public static function markFailed(Media $media): void
    {
        $variants = is_array($media->variants) ? $media->variants : [];
        $variants[self::FAILED] = true;
        $media->variants = $variants;
        $media->save();
    }

    /**
     * Кадр вытаскивает ffmpeg, а в WebP его переводит GD.
     *
     * ffmpeg умеет писать webp сам, но только если собран с libwebp: на
     * сервере он есть, на моей машине — нет, и тест на кодировщике, которого
     * может не оказаться, проверяет наличие пакета, а не наш код. GD с
     * imagewebp уже несёт весь конвейер картинок — берём его.
     *
     * @param  array{width: int, height: int, duration: float}  $probe
     * @return array{path: string, bytes: int, quality: int, width: int, height: int}|null
     */
    private function makePoster(Media $media, string $source, string $dir, array $probe): ?array
    {
        if (! function_exists('imagewebp')) {
            Log::warning('media_video_skipped', [
                'media_uuid' => $media->uuid,
                'reason' => 'gd_webp_missing',
            ]);

            return null;
        }

        $at = (float) config('media.video.poster.at_seconds', 1.0);

        // У ролика короче отступа кадра по этой метке нет: ffmpeg вернёт
        // пустой файл. Берём середину.
        if ($probe['duration'] > 0 && $at >= $probe['duration']) {
            $at = $probe['duration'] / 2;
        }

        $maxWidth = (int) config('media.video.poster.max_width', 1280);
        $frame = tempnam(sys_get_temp_dir(), 'mfrm').'.png';

        $ok = $this->run([
            $this->ffmpeg(), '-y',
            // -ss перед -i — перемотка по ключевым кадрам, на порядок быстрее
            // покадрового поиска в длинном файле.
            '-ss', (string) $at,
            '-i', $source,
            '-frames:v', '1',
            '-vf', "scale='min({$maxWidth},iw)':-2",
            $frame,
        ]);

        if (! $ok || ! is_file($frame) || filesize($frame) < 1) {
            @unlink($frame);

            return null;
        }

        $image = @imagecreatefrompng($frame);
        @unlink($frame);

        if ($image === false) {
            return null;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $budget = (int) config('media.video.poster.budget_bytes', 100 * 1024);
        $quality = (int) config('media.video.poster.q_start', 80);
        $qMin = (int) config('media.video.poster.q_min', 50);
        $qStep = max(1, (int) config('media.video.poster.q_step', 10));
        $best = null;

        while ($quality >= $qMin) {
            ob_start();
            $encoded = imagewebp($image, null, $quality) ? (string) ob_get_contents() : '';
            ob_end_clean();

            if ($encoded === '') {
                break;
            }

            $best = ['body' => $encoded, 'bytes' => strlen($encoded), 'quality' => $quality];

            if ($best['bytes'] <= $budget) {
                break;
            }

            $quality -= $qStep;
        }

        imagedestroy($image);

        if ($best === null) {
            return null;
        }

        if ($best['bytes'] > $budget) {
            Log::warning('media_heavy', [
                'media_uuid' => $media->uuid,
                'variant' => self::POSTER,
                'format' => 'webp',
                'bytes' => $best['bytes'],
                'budget' => $budget,
                'quality' => $best['quality'],
            ]);
        }

        $path = $dir.'/'.self::POSTER.'.webp';
        Storage::disk($media->disk)->put($path, $best['body'], ['visibility' => 'public']);

        return [
            'path' => $path,
            'bytes' => $best['bytes'],
            'quality' => $best['quality'],
            'width' => $width,
            'height' => $height,
        ];
    }

    /**
     * @param  array{width: int, height: int, duration: float}  $probe
     * @return array{path: string, bytes: int, width: int, height: int}|null
     */
    private function makeRendition(Media $media, string $source, string $dir, array $probe): ?array
    {
        $height = (int) config('media.video.rendition.height', 720);
        $out = tempnam(sys_get_temp_dir(), 'mrend').'.mp4';

        $ok = $this->run([
            $this->ffmpeg(), '-y',
            '-i', $source,
            // Не растягиваем: ролик ниже 720p остаётся своей высоты. -2 держит
            // ширину чётной — libx264 нечётную не примет.
            '-vf', "scale=-2:'min({$height},ih)'",
            '-c:v', 'libx264',
            '-preset', (string) config('media.video.rendition.preset', 'veryfast'),
            '-crf', (string) (int) config('media.video.rendition.crf', 26),
            '-c:a', 'aac',
            '-b:a', ((int) config('media.video.rendition.audio_kbps', 96)).'k',
            // Заголовок в начало файла: иначе браузер, чтобы узнать
            // длительность, читает файл до конца.
            '-movflags', '+faststart',
            $out,
        ]);

        $bytes = $ok && is_file($out) ? (int) filesize($out) : 0;

        if ($bytes <= 0) {
            @unlink($out);

            return null;
        }

        $sourceBytes = (int) ($media->size_bytes ?: filesize($source));
        $ratio = (float) config('media.video.rendition.min_saving_ratio', 0.8);

        // Копия тяжелее или почти равна исходнику — держать её незачем:
        // и место, и лишний адрес, по которому нечего экономить.
        if ($sourceBytes > 0 && $bytes > $sourceBytes * $ratio) {
            Log::info('media_video_rendition_skipped', [
                'media_uuid' => $media->uuid,
                'source_bytes' => $sourceBytes,
                'rendition_bytes' => $bytes,
            ]);
            @unlink($out);

            return null;
        }

        $path = $dir.'/'.$this->renditionName().'.mp4';
        Storage::disk($media->disk)->put($path, (string) file_get_contents($out), ['visibility' => 'public']);
        @unlink($out);

        $width = $probe['height'] > 0
            ? (int) round(min($height, $probe['height']) * $probe['width'] / $probe['height'])
            : 0;

        return [
            'path' => $path,
            'bytes' => $bytes,
            'width' => $width - ($width % 2),
            'height' => min($height, $probe['height']),
        ];
    }

    /**
     * @return array{width: int, height: int, duration: float}|null
     */
    private function probe(string $file): ?array
    {
        $process = new Process([
            $this->ffprobe(),
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height:format=duration',
            '-of', 'json',
            $file,
        ]);
        $process->setTimeout(60);

        try {
            $process->run();
        } catch (Throwable) {
            return null;
        }

        if (! $process->isSuccessful()) {
            return null;
        }

        $decoded = json_decode($process->getOutput(), true);

        if (! is_array($decoded)) {
            return null;
        }

        $stream = $decoded['streams'][0] ?? null;
        $width = (int) ($stream['width'] ?? 0);
        $height = (int) ($stream['height'] ?? 0);

        if ($width < 1 || $height < 1) {
            return null;
        }

        return [
            'width' => $width,
            'height' => $height,
            'duration' => (float) ($decoded['format']['duration'] ?? 0),
        ];
    }

    /**
     * @param  array<int, string>  $command
     */
    private function run(array $command): bool
    {
        $process = new Process($command);
        $process->setTimeout((float) config('media.video.timeout', 1500));

        try {
            $process->run();
        } catch (ProcessTimedOutException $e) {
            Log::error('media_video_timeout', ['command' => $command[1] ?? '', 'exception' => $e->getMessage()]);

            return false;
        } catch (Throwable $e) {
            Log::error('media_video_process_failed', ['exception' => $e->getMessage()]);

            return false;
        }

        if (! $process->isSuccessful()) {
            Log::warning('media_video_ffmpeg_error', [
                'exit' => $process->getExitCode(),
                // Последние строки: ffmpeg пишет в stderr весь свой баннер.
                'stderr' => mb_substr(trim($process->getErrorOutput()), -400),
            ]);

            return false;
        }

        return true;
    }

    private function downloadToTemp(Media $media): ?string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'mvid');

        if ($tmp === false) {
            return null;
        }

        try {
            // Потоком, а не в память: ролики измеряются сотнями мегабайт, и
            // Storage::get() положил бы воркер на memory_limit.
            $stream = Storage::disk($media->disk)->readStream($media->path);

            if ($stream === null) {
                @unlink($tmp);

                return null;
            }

            $out = fopen($tmp, 'wb');

            if ($out === false) {
                fclose($stream);
                @unlink($tmp);

                return null;
            }

            stream_copy_to_stream($stream, $out);
            fclose($out);
            fclose($stream);
        } catch (Throwable) {
            @unlink($tmp);

            return null;
        }

        return filesize($tmp) > 0 ? $tmp : null;
    }

    private function variantDirectory(Media $media): string
    {
        $dir = pathinfo($media->path, PATHINFO_DIRNAME);
        $stem = pathinfo($media->path, PATHINFO_FILENAME);

        return trim($dir.'/'.$stem, '/');
    }

    private function binariesAvailable(): bool
    {
        foreach ([$this->ffmpeg(), $this->ffprobe()] as $binary) {
            $check = new Process(['sh', '-c', 'command -v '.escapeshellarg($binary)]);
            $check->setTimeout(10);
            $check->run();

            if (! $check->isSuccessful()) {
                return false;
            }
        }

        return true;
    }

    private function ffmpeg(): string
    {
        return (string) config('media.video.ffmpeg', 'ffmpeg');
    }

    private function ffprobe(): string
    {
        return (string) config('media.video.ffprobe', 'ffprobe');
    }
}
