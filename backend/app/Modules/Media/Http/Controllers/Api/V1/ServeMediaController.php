<?php

namespace Modules\Media\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Public media proxy. Streams Ready media from the (private) object storage,
 * so the shared bucket never needs to be made world-readable.
 *
 * Private purposes are never served here. Chat attachments use the same
 * unguessable-UUID posture as voice notes so <img>/<audio> can load them
 * without an Authorization header.
 */
class ServeMediaController extends Controller
{
    /**
     * Purposes that are safe to serve to anonymous clients. Voice notes are
     * addressed by an unguessable UUID (same posture as the rest of the media
     * proxy) so they can be played back via a plain <audio> element.
     */
    private const PUBLIC_PURPOSES = ['avatar', 'cover', 'post', 'post_video', 'listing', 'banner', 'icon', 'voice', 'review_video', 'chat'];

    public function __invoke(Request $request, string $uuid): StreamedResponse
    {
        $media = Media::query()->where('uuid', $uuid)->first();

        if (! $media || ! $media->isReady()) {
            abort(404);
        }

        $purpose = explode('/', (string) $media->path)[1] ?? '';

        if (! in_array($purpose, self::PUBLIC_PURPOSES, true)) {
            abort(403);
        }

        $disk = Storage::disk($media->disk);

        if (! $disk->exists($media->path)) {
            abort(404);
        }

        return $this->streamFile($request, $disk, $media, $uuid);
    }

    private function streamFile(Request $request, $disk, Media $media, string $uuid): StreamedResponse
    {
        $size = (int) ($media->size_bytes ?? 0);
        $mime = $media->mime_type ?: 'application/octet-stream';
        $filename = addslashes($media->filename ?: $uuid);

        $headers = [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=31536000, immutable',
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

        $path = $media->path;
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
