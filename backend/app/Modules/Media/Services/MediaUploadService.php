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
use Modules\Media\Jobs\ProcessMediaVariantsJob;
use Modules\Media\Jobs\ProcessVideoJob;

class MediaUploadService
{
    /** 1 GiB — messenger photo / video / file attachments. */
    private const CHAT_MAX_SIZE = 1_073_741_824;

    /** @var array<string, array{max_files: int, max_size: int, mimes: list<string>}> */
    private const LIMITS = [
        'avatar' => ['max_files' => 1, 'max_size' => 5_242_880, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'post' => ['max_files' => 10, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'post_video' => ['max_files' => 3, 'max_size' => 104_857_600, 'mimes' => ['video/mp4', 'video/webm']],
        'comment' => ['max_files' => 4, 'max_size' => 5_242_880, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'listing' => ['max_files' => 20, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'banner' => ['max_files' => 1, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'cover' => ['max_files' => 1, 'max_size' => 10_485_760, 'mimes' => ['image/jpeg', 'image/png', 'image/webp']],
        'review_video' => ['max_files' => 1, 'max_size' => 209_715_200, 'mimes' => ['video/mp4', 'video/webm', 'video/quicktime']],
        // Запись экрана к странице «Как пользоваться»: те же пределы, что
        // у обзора. Отдельным назначением, а не поверх `review_video`:
        // перепутать витрину обзоров с одним файлом на странице легко,
        // а строка в таблице стоит дешевле путаницы.
        'guide_video' => ['max_files' => 1, 'max_size' => 209_715_200, 'mimes' => ['video/mp4', 'video/webm', 'video/quicktime']],
        'chat' => ['max_files' => 10, 'max_size' => self::CHAT_MAX_SIZE, 'mimes' => [
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/webm', 'video/quicktime',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed',
        ]],
        // Voice notes recorded in the browser. webm/opus is reported as video/webm
        // by libmagic, so it is accepted alongside the audio/* variants.
        'voice' => ['max_files' => 1, 'max_size' => 20_971_520, 'mimes' => ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'video/webm', 'video/mp4']],
        'icon' => ['max_files' => 50, 'max_size' => 2_097_152, 'mimes' => ['image/png', 'image/svg+xml']],
        'logo' => ['max_files' => 1, 'max_size' => 5_242_880, 'mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']],
        'dispute' => ['max_files' => 5, 'max_size' => 10_485_760, 'mimes' => [
            'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        ]],
    ];

    /**
     * Назначения, которые обычному пользователю заводить нечего.
     *
     * Это оформление площадки, а не его содержимое, и оба допускают
     * `image/svg+xml`. До 03.10 проверка стояла только на прямой загрузке
     * (`DirectUploadController` перехватывал `icon` и требовал `isOwner`), а
     * `UploadSessionController` её не повторял: `purpose` там валидировался
     * одним `Rule::in(purposes())`, то есть включая `icon`, `logo` и
     * `dispute`. Любой подтверждённый пользователь открывал сессию с
     * `purpose=icon`, клал в бакет свой SVG и получал его по ссылке прокси.
     *
     * Правило живёт здесь, а не в контроллерах, именно поэтому: два пути
     * загрузки один раз уже разошлись.
     *
     * Штатная админская загрузка (`AdminMediaController`) сюда не смотрит — у
     * неё свой страж `admin.section:media`, и это осознанно: раздел медиа
     * открыт модерации.
     */
    public const STAFF_ONLY_PURPOSES = ['icon', 'logo'];

    /** @return list<string> */
    public static function purposes(): array
    {
        return array_keys(self::LIMITS);
    }

    /** Можно ли этому человеку загружать с таким назначением. */
    public static function purposeAllowedFor(?User $user, string $purpose): bool
    {
        if (! in_array($purpose, self::STAFF_ONLY_PURPOSES, true)) {
            return true;
        }

        return $user !== null && $user->isOwner();
    }

    public static function maxSizeKb(string $purpose): int
    {
        $bytes = self::LIMITS[$purpose]['max_size'] ?? 10_485_760;

        return (int) ceil($bytes / 1024);
    }

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
        /*
         * Расширение выводится из проверенного по содержимому типа и никогда
         * из клиентского имени.
         *
         * До 03.10 в `?:`-ветке стояло `$file->getClientOriginalExtension()`,
         * а это `pathinfo(..., PATHINFO_EXTENSION)` без всякого фильтра. Из
         * всех типов в LIMITS сопоставления не было ровно у одного —
         * `video/webm`, разрешённого в пяти назначениях, — и валидный WebM с
         * именем `shell.php` сохранялся как `…/{uuid}.php`. Штатный замок
         * Laravel (`shouldBlockPhpUpload`) не срабатывал: он живёт внутри
         * правил `mimes:`/`mimetypes:`, которых на боевых точках нет — тип
         * проверяется выше, в этом же методе, через `getMimeType()`.
         *
         * Исполнения это не давало, потому что объект уезжает в S3, а ссылки
         * `public/storage` нет. Но ценой одной строки в `deploy/` — диск
         * `public`, `storage:link`, отдача бакета вебсервером с обработкой PHP
         * — превратилось бы в выполнение кода. Пресайн-путь уже так и устроен
         * (`createSession` жёстко подставляет `bin`), теперь оба пути ведут
         * себя одинаково.
         */
        $extension = $this->extensionForMime($mime) ?? 'bin';
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

        $media = Media::create([
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

        $this->dispatchVariants($media);

        return $media;
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

            if ($media->status === MediaStatus::Failed) {
                throw ValidationException::withMessages([
                    'media_uuids' => ["Загрузка файла {$uuid} отменена."],
                ]);
            }

            if (! Storage::disk($media->disk)->exists($media->path)) {
                throw ValidationException::withMessages([
                    'media_uuids' => ["Файл {$uuid} не найден в хранилище."],
                ]);
            }

            $this->сверитьЗагруженное($media, (string) $session->purpose, $uuid);

            $permanentPath = str_replace('tmp/', 'media/', $media->path);

            if ($permanentPath !== $media->path) {
                Storage::disk($media->disk)->move($media->path, $permanentPath);
                $media->path = $permanentPath;
            }

            $media->status = MediaStatus::Ready;
            $media->save();
            $this->dispatchVariants($media);

            $confirmed[] = $media;
        }

        return $confirmed;
    }

    /**
     * Сверить то, что действительно лежит в бакете, с тем, что заявил клиент.
     *
     * До 03.10 пресайн-путь не проверял содержимое ни разу. Тип и размер
     * брались из JSON-тела `createSession`, байты клиент кладёт прямо в бакет
     * по presigned PUT, минуя приложение, а `confirm` смотрел только на
     * владение, сессию, статус и факт существования объекта. Следствий было
     * два: под заявленным `image/png` лежало что угодно, а предел размера был
     * рекомендацией — заявить `size: 1` и положить 50 ГБ, за которые платит
     * владелец бакета.
     *
     * Размер берётся у хранилища. Тип определяется по началу файла: finfo
     * опознаёт формат по сигнатуре, и первых килобайт для этого достаточно —
     * тянуть к себе двухсотмегабайтное видео, чтобы узнать, что оно видео,
     * незачем.
     *
     * Промах закрывает загрузку: статус `Failed`, объект убран, отказ
     * валидации. Оставить заявленный тип значило бы отдавать потом файл с
     * `Content-Type`, которому он не соответствует.
     */
    private function сверитьЗагруженное(Media $media, string $purpose, string $uuid): void
    {
        $limits = self::LIMITS[$purpose] ?? null;

        if ($limits === null) {
            return;
        }

        $disk = Storage::disk($media->disk);
        $размер = (int) $disk->size($media->path);

        $отказ = null;

        if ($размер > $limits['max_size']) {
            $отказ = "Файл {$uuid} больше заявленного и превышает допустимый размер.";
        } else {
            $начало = '';
            $поток = $disk->readStream($media->path);
            if (is_resource($поток)) {
                $начало = (string) fread($поток, 8192);
                fclose($поток);
            }

            $тип = $начало === '' ? null : (new \finfo(FILEINFO_MIME_TYPE))->buffer($начало);

            if (is_string($тип) && ! in_array($тип, $limits['mimes'], true)) {
                $отказ = "Содержимое файла {$uuid} не совпадает с заявленным типом.";
            } elseif (is_string($тип)) {
                // Заявленный тип мог быть любым из списка; записываем тот,
                // который действительно в файле, иначе прокси отдаст чужой
                // `Content-Type`.
                $media->mime_type = $тип;
            }
        }

        if ($отказ !== null) {
            $media->status = MediaStatus::Failed;
            $media->save();
            // Объект ещё во временном каталоге и производных копий не имеет
            // (`dispatchVariants` зовётся ниже, уже после сверки), поэтому
            // здесь достаточно одного пути и `MediaDeletionService` не нужен.
            $disk->delete($media->path);

            throw ValidationException::withMessages(['media_uuids' => [$отказ]]);
        }

        $media->size_bytes = $размер;
    }

    /** @param  list<string>  $mediaUuids */
    public function fail(User $user, array $mediaUuids): void
    {
        foreach ($mediaUuids as $uuid) {
            $media = Media::query()
                ->where('uuid', $uuid)
                ->where('uploaded_by', $user->id)
                ->first();

            if (! $media) {
                throw ValidationException::withMessages([
                    'media_uuids' => ["Медиафайл {$uuid} не найден."],
                ]);
            }

            if ($media->status === MediaStatus::Ready) {
                continue;
            }

            $media->status = MediaStatus::Failed;
            $media->save();
        }
    }

    private function dispatchVariants(Media $media): void
    {
        // Видео идёт своей дорогой: GD его не откроет, а ffmpeg считает
        // минутами и потому работает в отдельной очереди.
        if (str_starts_with((string) $media->mime_type, 'video/')) {
            if (config('media.video.enabled', true)) {
                ProcessVideoJob::dispatch($media->id);
            }

            return;
        }

        if (! config('media.variants.enabled', true)) {
            return;
        }

        ProcessMediaVariantsJob::dispatch($media->id);
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
            // Голосовые записи браузера libmagic тоже называет `video/webm`
            // (см. комментарий к `voice` в LIMITS), поэтому расширение одно
            // на оба назначения.
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            'audio/webm' => 'weba',
            'audio/ogg' => 'ogg',
            'audio/mpeg' => 'mp3',
            'audio/mp4' => 'm4a',
            'audio/wav', 'audio/x-wav' => 'wav',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-powerpoint' => 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
            'text/plain' => 'txt',
            'application/zip' => 'zip',
            'application/x-zip-compressed' => 'zip',
            'image/svg+xml' => 'svg',
            default => null,
        };
    }
}
