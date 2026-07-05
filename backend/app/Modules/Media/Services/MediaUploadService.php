<?php

namespace Modules\Media\Services;

use App\Enums\MediaStatus;
use App\Models\Media;
use App\Models\UploadSession;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MediaUploadService
{
    /** @var array<string, array{max_files: int, max_size: int, mimes: list<string>}> */
    private const LIMITS = [
        'avatar' => ['max_files' => 1, 'max_size' => 5_242_880, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'post' => ['max_files' => 10, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'post_video' => ['max_files' => 3, 'max_size' => 104_857_600, 'mimes' => ['video/mp4', 'video/webm']],
        'listing' => ['max_files' => 20, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'banner' => ['max_files' => 1, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'chat' => ['max_files' => 10, 'max_size' => 26_214_400, 'mimes' => ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf']],
        // Voice notes recorded in the browser. webm/opus is reported as video/webm
        // by libmagic, so it is accepted alongside the audio/* variants.
        'voice' => ['max_files' => 1, 'max_size' => 20_971_520, 'mimes' => ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'video/webm', 'video/mp4']],
    ];

    /**
     * @param  array{purpose: string, files: list<array{name: string, size: int, mime: string}>}  $payload
     * @return array{session_uuid: string, expires_at: string, uploads: list<array{media_uuid: string, upload_url: string, path: string, headers: array<string, string>}>}
     */
    public function createSession(User $user, array $payload): array
    {
        $purpose = $payload['purpose'];
        $files = $payload['files'];

        if (! isset(self::LIMITS[$purpose])) {
            throw ValidationException::withMessages([
                'purpose' => ['Неизвестное назначение загрузки.'],
            ]);
        }

        $limits = self::LIMITS[$purpose];

        if (count($files) > $limits['max_files']) {
            throw ValidationException::withMessages([
                'files' => ["Не более {$limits['max_files']} файлов."],
            ]);
        }

        $session = UploadSession::create([
            'user_id' => $user->id,
            'purpose' => $purpose,
            'max_files' => $limits['max_files'],
            'max_size_bytes' => $limits['max_size'],
            'expires_at' => now()->addHour(),
        ]);

        $uploads = [];

        foreach ($files as $file) {
            if ($file['size'] > $limits['max_size']) {
                throw ValidationException::withMessages([
                    'files' => ['Файл превышает допустимый размер.'],
                ]);
            }

            if (! in_array($file['mime'], $limits['mimes'], true)) {
                throw ValidationException::withMessages([
                    'files' => ['Недопустимый тип файла.'],
                ]);
            }

            $path = sprintf(
                'tmp/%s/%s/%s',
                $purpose,
                $session->uuid,
                Str::uuid()->toString().'-'.Str::slug(pathinfo($file['name'], PATHINFO_FILENAME)).'.'.($this->extensionForMime($file['mime']) ?? 'bin'),
            );

            $media = Media::create([
                'disk' => config('filesystems.default', 's3'),
                'path' => $path,
                'filename' => $file['name'],
                'mime_type' => $file['mime'],
                'size_bytes' => $file['size'],
                'uploaded_by' => $user->id,
                'status' => MediaStatus::Pending,
                'metadata' => ['upload_session_uuid' => $session->uuid],
            ]);

            $uploads[] = [
                'media_uuid' => $media->uuid,
                'upload_url' => $this->presignedPutUrl($media->disk, $path, $file['mime']),
                'path' => $path,
                'headers' => ['Content-Type' => $file['mime']],
            ];
        }

        return [
            'session_uuid' => $session->uuid,
            'expires_at' => $session->expires_at->toIso8601String(),
            'uploads' => $uploads,
        ];
    }

    /**
     * Direct server-side upload: receives the file, stores it on the configured
     * disk (public), extracts image dimensions, and returns a ready Media row.
     */
    public function storeUploadedFile(User $user, UploadedFile $file, string $purpose, ?int $durationSeconds = null): Media
    {
        if (! isset(self::LIMITS[$purpose])) {
            throw ValidationException::withMessages([
                'purpose' => ['Неизвестное назначение загрузки.'],
            ]);
        }

        $limits = self::LIMITS[$purpose];
        $mime = $file->getMimeType() ?? $file->getClientMimeType();
        $size = $file->getSize() ?? 0;

        if ($size > $limits['max_size']) {
            throw ValidationException::withMessages([
                'file' => ['Файл превышает допустимый размер.'],
            ]);
        }

        if (! in_array($mime, $limits['mimes'], true)) {
            throw ValidationException::withMessages([
                'file' => ['Недопустимый тип файла.'],
            ]);
        }

        [$width, $height] = $this->imageDimensions($file, $mime);

        $disk = config('filesystems.default', 's3');
        $extension = $this->extensionForMime($mime) ?? ($file->getClientOriginalExtension() ?: 'bin');
        $path = sprintf(
            'media/%s/%s/%s.%s',
            $purpose,
            now()->format('Y/m'),
            Str::uuid()->toString(),
            $extension,
        );

        $stream = fopen($file->getRealPath(), 'rb');
        Storage::disk($disk)->put($path, $stream, ['visibility' => 'public']);
        if (is_resource($stream)) {
            fclose($stream);
        }

        return Media::create([
            'disk' => $disk,
            'path' => $path,
            'filename' => $file->getClientOriginalName(),
            'mime_type' => $mime,
            'size_bytes' => $size,
            'width' => $width,
            'height' => $height,
            'duration_seconds' => $durationSeconds,
            'uploaded_by' => $user->id,
            'status' => MediaStatus::Ready,
            'metadata' => ['upload' => 'direct'],
        ]);
    }

    /** @return array{0: ?int, 1: ?int} */
    private function imageDimensions(UploadedFile $file, ?string $mime): array
    {
        if (! is_string($mime) || ! str_starts_with($mime, 'image/')) {
            return [null, null];
        }

        try {
            $info = getimagesize($file->getRealPath());
            if (is_array($info)) {
                return [$info[0] ?? null, $info[1] ?? null];
            }
        } catch (\Throwable) {
            // Ignore — dimensions are best-effort metadata.
        }

        return [null, null];
    }

    /** @param  list<string>  $mediaUuids */
    public function confirm(User $user, string $sessionUuid, array $mediaUuids): array
    {
        $session = UploadSession::query()
            ->where('uuid', $sessionUuid)
            ->where('user_id', $user->id)
            ->first();

        if (! $session || $session->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'session_uuid' => ['Сессия загрузки не найдена или истекла.'],
            ]);
        }

        $confirmed = [];

        foreach ($mediaUuids as $uuid) {
            $media = Media::query()
                ->where('uuid', $uuid)
                ->where('uploaded_by', $user->id)
                ->first();

            if (! $media || ($media->metadata['upload_session_uuid'] ?? null) !== $session->uuid) {
                throw ValidationException::withMessages([
                    'media_uuids' => ["Медиафайл {$uuid} не принадлежит сессии."],
                ]);
            }

            if (! Storage::disk($media->disk)->exists($media->path)) {
                throw ValidationException::withMessages([
                    'media_uuids' => ["Файл {$uuid} не найден в хранилище."],
                ]);
            }

            $permanentPath = str_replace('tmp/', 'media/', $media->path);

            if ($permanentPath !== $media->path) {
                Storage::disk($media->disk)->move($media->path, $permanentPath);
                $media->path = $permanentPath;
            }

            $media->status = MediaStatus::Ready;
            $media->save();

            $confirmed[] = $media;
        }

        return $confirmed;
    }

    private function presignedPutUrl(string $disk, string $path, string $mime): string
    {
        $storage = Storage::disk($disk);

        try {
            if (method_exists($storage, 'temporaryUploadUrl')) {
                ['url' => $url] = $storage->temporaryUploadUrl($path, now()->addHour(), [
                    'ContentType' => $mime,
                ]);

                return $url;
            }
        } catch (\RuntimeException) {
            // Local / fake disks used in tests do not support presigned uploads.
        }

        return $storage->url($path);
    }

    private function extensionForMime(string $mime): ?string
    {
        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'audio/webm' => 'weba',
            'audio/ogg' => 'ogg',
            'audio/mpeg' => 'mp3',
            'audio/mp4' => 'm4a',
            'audio/wav', 'audio/x-wav' => 'wav',
            'application/pdf' => 'pdf',
            default => null,
        };
    }
}
