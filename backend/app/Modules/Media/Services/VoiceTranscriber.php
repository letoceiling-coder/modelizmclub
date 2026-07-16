<?php

namespace Modules\Media\Services;

use App\Models\Media;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Media\Exceptions\TranscriptionException;

/**
 * Speech-to-text for voice messages.
 *
 * Supported providers (config media.transcription.provider):
 *  - "stub"   — returns fixed placeholder text (dev/CI default).
 *  - "yandex" — Yandex SpeechKit synchronous recognition. Browser audio
 *               (webm/opus, mp4, ogg) is normalized to mono OggOpus and split
 *               into <=segment_seconds chunks (the sync API caps at 30s), each
 *               recognized in turn and joined into one transcript.
 */
class VoiceTranscriber
{
    /**
     * @return array{text: string, lang: string}|null
     *
     * @throws TranscriptionException on provider/config/runtime failure
     */
    public function transcribe(Media $media): ?array
    {
        $provider = (string) config('media.transcription.provider', 'stub');

        if ($provider === 'stub' || config('media.transcription.stub')) {
            return [
                'text' => (string) config('media.transcription.stub_text'),
                'lang' => (string) config('media.transcription.stub_lang', 'ru'),
            ];
        }

        if ($provider === 'yandex') {
            return $this->transcribeWithYandex($media);
        }

        return null;
    }

    /**
     * @return array{text: string, lang: string}
     *
     * @throws TranscriptionException
     */
    private function transcribeWithYandex(Media $media): array
    {
        $apiKey = (string) config('media.transcription.yandex.api_key');
        $folderId = (string) config('media.transcription.yandex.folder_id');
        $lang = (string) config('media.transcription.yandex.lang', 'ru-RU');
        $topic = (string) config('media.transcription.yandex.topic', 'general');
        $endpoint = (string) config('media.transcription.yandex.endpoint');

        if ($apiKey === '' || $folderId === '') {
            throw new TranscriptionException('Расшифровка недоступна — не настроены ключи Yandex SpeechKit.');
        }

        $bytes = Storage::disk($media->disk)->get($media->path);
        if ($bytes === null || $bytes === '') {
            throw new TranscriptionException('Не удалось прочитать аудиофайл для расшифровки.');
        }

        $workDir = storage_path('app/tmp/stt/'.Str::uuid()->toString());
        if (! @mkdir($workDir, 0775, true) && ! is_dir($workDir)) {
            throw new TranscriptionException('Не удалось подготовить временную директорию для расшифровки.');
        }

        try {
            $chunks = $this->segmentToOggOpus($bytes, $workDir);
            if ($chunks === []) {
                throw new TranscriptionException('Аудиофайл пуст или не удалось его обработать.');
            }

            $parts = [];
            foreach ($chunks as $chunkPath) {
                $chunkBytes = (string) file_get_contents($chunkPath);
                if ($chunkBytes === '') {
                    continue;
                }
                $text = $this->recognizeChunk($endpoint, $apiKey, $folderId, $lang, $topic, $chunkBytes);
                if ($text !== '') {
                    $parts[] = $text;
                }
            }

            $full = trim(implode(' ', $parts));

            return [
                'text' => $full,
                'lang' => str_starts_with($lang, 'ru') ? 'ru' : $lang,
            ];
        } finally {
            $this->cleanup($workDir);
        }
    }

    /**
     * Normalize arbitrary browser audio to mono OggOpus and split into chunks
     * short enough for the synchronous SpeechKit endpoint.
     *
     * @return list<string> absolute paths to the produced .ogg chunks, ordered
     *
     * @throws TranscriptionException
     */
    private function segmentToOggOpus(string $bytes, string $workDir): array
    {
        $ffmpeg = (string) config('media.transcription.ffmpeg', 'ffmpeg');
        $segment = max(5, (int) config('media.transcription.segment_seconds', 25));

        $srcPath = $workDir.DIRECTORY_SEPARATOR.'source';
        file_put_contents($srcPath, $bytes);

        $pattern = $workDir.DIRECTORY_SEPARATOR.'chunk_%03d.ogg';

        $result = Process::timeout(120)->run([
            $ffmpeg,
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', $srcPath,
            '-vn',
            '-ac', '1',
            '-ar', '48000',
            '-c:a', 'libopus',
            '-b:a', '24k',
            '-f', 'segment',
            '-segment_time', (string) $segment,
            $pattern,
        ]);

        if (! $result->successful()) {
            Log::warning('VoiceTranscriber ffmpeg failed', [
                'media_disk' => $workDir,
                'stderr' => $result->errorOutput(),
            ]);
            throw new TranscriptionException('Не удалось декодировать аудио для расшифровки (ffmpeg).');
        }

        $chunks = glob($workDir.DIRECTORY_SEPARATOR.'chunk_*.ogg') ?: [];
        sort($chunks);

        return array_values($chunks);
    }

    /**
     * @throws TranscriptionException
     */
    private function recognizeChunk(
        string $endpoint,
        string $apiKey,
        string $folderId,
        string $lang,
        string $topic,
        string $audio,
    ): string {
        $url = $endpoint.'?'.http_build_query([
            'folderId' => $folderId,
            'lang' => $lang,
            'topic' => $topic,
            'format' => 'oggopus',
        ]);

        $response = Http::withHeaders(['Authorization' => 'Api-Key '.$apiKey])
            ->withBody($audio, 'audio/ogg')
            ->connectTimeout(10)
            ->timeout(30)
            ->retry(2, 500, throw: false)
            ->post($url);

        if (! $response->successful()) {
            $message = (string) ($response->json('error_message') ?? $response->body());
            Log::warning('VoiceTranscriber SpeechKit error', [
                'status' => $response->status(),
                'message' => $message,
            ]);
            throw new TranscriptionException('Сервис распознавания речи вернул ошибку.');
        }

        return trim((string) $response->json('result', ''));
    }

    private function cleanup(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        foreach (glob($dir.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }
}
