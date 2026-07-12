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
 * Private purposes (e.g. chat attachments) are never served here.
 */
class ServeMediaController extends Controller
{
    /**
     * Purposes that are safe to serve to anonymous clients. Voice notes are
     * addressed by an unguessable UUID (same posture as the rest of the media
     * proxy) so they can be played back via a plain <audio> element.
     */
    private const PUBLIC_PURPOSES = ['avatar', 'cover', 'post', 'post_video', 'listing', 'banner', 'voice', 'review_video'];

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

        $stream = $disk->readStream($media->path);

        return response()->stream(function () use ($stream): void {
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, array_filter([
            'Content-Type' => $media->mime_type ?: 'application/octet-stream',
            'Content-Length' => $media->size_bytes ? (string) $media->size_bytes : null,
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Disposition' => 'inline; filename="'.addslashes($media->filename ?: $uuid).'"',
        ]));
    }
}
