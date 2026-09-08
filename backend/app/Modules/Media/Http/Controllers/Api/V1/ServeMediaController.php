<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Modules\Media\Services\MediaVariantProcessor;
use Modules\Media\Services\VideoProcessor;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Public media proxy. Streams Ready media from the (private) object storage,
 * so the shared bucket never needs to be made world-readable.
 *
 * Private purposes are never served here. Chat attachments use the same
 * unguessable-UUID posture as voice notes so <img>/<audio> can load them
 * without an Authorization header.
 *
 * Variant URLs (/media/{uuid}/card.avif) fall back to the original with a
 * short cache if the job has not finished — never 404 a visible image.
 */
class ServeMediaController extends Controller
{
    /**
     * Purposes that are safe to serve to anonymous clients. Voice notes are
     * addressed by an unguessable UUID (same posture as the rest of the media
     * proxy) so they can be played back via a plain <audio> element.
     */
    private const PUBLIC_PURPOSES = ['avatar', 'cover', 'post', 'post_video', 'listing', 'banner', 'icon', 'voice', 'review_video', 'chat'];

    /** Доказательства по спору: не публичные, но и не «никому». */
    private const DISPUTE_PURPOSE = 'dispute';

    public function __invoke(Request $request, MediaVariantProcessor $processor, string $uuid, ?string $variant = null): StreamedResponse
    {
        $media = Media::query()->where('uuid', $uuid)->first();

        if (! $media || ! $media->isReady()) {
            abort(404);
        }

        $purpose = $media->purpose;

        if (! in_array($purpose, self::PUBLIC_PURPOSES, true) && ! $this->mayViewPrivate($media, $purpose)) {
            abort(403);
        }

        $disk = Storage::disk($media->disk);
        $parsed = $this->parseVariant($variant);

        if ($parsed !== null) {
            $variantPath = $processor->variantStoragePath($media, $parsed['name'], $parsed['ext']);

            if (is_string($variantPath) && $disk->exists($variantPath)) {
                $bytes = (int) ($media->variants[$parsed['name']][$parsed['format']]['bytes'] ?? $disk->size($variantPath));

                return $this->streamPath(
                    $request,
                    $disk,
                    $variantPath,
                    $parsed['mime'],
                    $bytes,
                    $uuid.'.'.$parsed['ext'],
                    'public, max-age=31536000, immutable',
                );
            }

            if (! $disk->exists($media->path)) {
                abort(404);
            }

            return $this->streamPath(
                $request,
                $disk,
                $media->path,
                $media->mime_type ?: 'application/octet-stream',
                (int) ($media->size_bytes ?? 0),
                $media->filename ?: $uuid,
                'public, max-age=60',
            );
        }

        if (! $disk->exists($media->path)) {
            abort(404);
        }

        return $this->streamPath(
            $request,
            $disk,
            $media->path,
            $media->mime_type ?: 'application/octet-stream',
            (int) ($media->size_bytes ?? 0),
            $media->filename ?: $uuid,
            'public, max-age=31536000, immutable',
        );
    }

    /**
     * @return array{name: string, ext: string, format: string, mime: string}|null
     */
    /**
     * Кто видит файл непубличного назначения.
     *
     * До 08.09 такой ветки не было вовсе: прокси либо отдавал всем, либо
     * отвечал 403. Файлы спора при этом загружались (purpose `dispute`
     * заведён в MediaUploadService), но открыть их не мог никто — ни
     * покупатель, ни продавец, ни модератор, который по ним решает, кому
     * достанутся деньги. Замерено на проде 08.09: 403 всем четверым,
     * включая аноним.
     *
     * Маршрут лежит вне `auth:sanctum` — иначе <img> без заголовка перестал
     * бы грузить аватары, — поэтому зритель берётся из гарда напрямую.
     * Ссылку на такой файл интерфейс открывает запросом с токеном, а не
     * <a href>.
     */
    private function mayViewPrivate(Media $media, string $purpose): bool
    {
        if ($purpose !== self::DISPUTE_PURPOSE) {
            return false;
        }

        $user = auth('sanctum')->user();

        if (! $user instanceof User) {
            return false;
        }

        // Модератор разбирает спор, автор перечитывает своё вложение.
        if ($user->isModerator() || (int) $media->uploaded_by === (int) $user->id) {
            return true;
        }

        // Вторая сторона сделки: файл приложен к спору по её сделке.
        $deal = Dispute::query()
            ->whereJsonContains('evidence', [['uuid' => $media->uuid]])
            ->with('safeDeal')
            ->first()?->safeDeal;

        return $deal !== null
            && ((int) $deal->buyer_id === (int) $user->id || (int) $deal->seller_id === (int) $user->id);
    }

    private function parseVariant(?string $variant): ?array
    {
        if ($variant === null || $variant === '') {
            return null;
        }

        // Постер и облегчённая копия видео живут в той же колонке variants,
        // что и размеры картинок, и различаются только именем слота.
        $rendition = (string) config('media.video.rendition.name', '720p');

        if ($variant === $rendition.'.mp4') {
            return [
                'name' => $rendition,
                'ext' => 'mp4',
                'format' => 'mp4',
                'mime' => 'video/mp4',
            ];
        }

        if ($variant === VideoProcessor::POSTER.'.webp') {
            return [
                'name' => VideoProcessor::POSTER,
                'ext' => 'webp',
                'format' => 'webp',
                'mime' => 'image/webp',
            ];
        }

        if (! preg_match('/^(thumb|card|medium|large)\.(avif|webp|jpg)$/', $variant, $matches)) {
            abort(404);
        }

        $ext = $matches[2];

        return [
            'name' => $matches[1],
            'ext' => $ext,
            'format' => match ($ext) {
                'jpg' => 'jpeg',
                default => $ext,
            },
            'mime' => match ($ext) {
                'avif' => 'image/avif',
                'webp' => 'image/webp',
                default => 'image/jpeg',
            },
        ];
    }

    private function streamPath(
        Request $request,
        mixed $disk,
        string $path,
        string $mime,
        int $size,
        string $filename,
        string $cacheControl,
    ): StreamedResponse {
        $filename = addslashes($filename);

        $headers = [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => $cacheControl,
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ];

        $start = 0;
        $end = $size > 0 ? $size - 1 : 0;
        $status = 200;

        if ($size > 0 && $request->headers->has('Range')) {
            if (preg_match('/bytes=(\d+)-(\d*)/', (string) $request->header('Range'), $matches)) {
                $start = (int) $matches[1];
                $end = $matches[2] !== '' ? (int) $matches[2] : $size - 1;
                $end = min($end, $size - 1);

                if ($start <= $end) {
                    $status = 206;
                    $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
                    $headers['Content-Length'] = (string) ($end - $start + 1);
                } else {
                    $start = 0;
                    $end = $size - 1;
                }
            }
        } elseif ($size > 0) {
            $headers['Content-Length'] = (string) $size;
        }

        $rangeStart = $start;
        $rangeEnd = $end;

        return response()->stream(function () use ($disk, $path, $rangeStart, $rangeEnd): void {
            $stream = $disk->readStream($path);
            if (! is_resource($stream)) {
                return;
            }

            if ($rangeStart > 0) {
                fseek($stream, $rangeStart);
            }

            $remaining = $rangeEnd - $rangeStart + 1;
            while ($remaining > 0 && ! feof($stream)) {
                $chunk = fread($stream, (int) min(8192, $remaining));
                if ($chunk === false) {
                    break;
                }
                echo $chunk;
                $remaining -= strlen($chunk);
            }

            fclose($stream);
        }, $status, array_filter($headers));
    }
}
