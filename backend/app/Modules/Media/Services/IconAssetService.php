<?php

namespace Modules\Media\Services;

use App\Enums\MediaStatus;
use App\Models\IconAsset;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class IconAssetService
{
    public function __construct(
        private readonly SvgIconSanitizer $sanitizer,
        private readonly MediaUploadService $uploads,
    ) {}

    public function createFromSvgString(string $raw, string $name, User $user, ?Media $media = null): IconAsset
    {
        $svg = $this->sanitizer->sanitize($raw);

        return IconAsset::create([
            'name' => $name ?: 'icon',
            'format' => 'svg',
            'svg' => $svg,
            'media_id' => $media?->id,
            'source' => $media ? 'media' : 'upload',
            'uploaded_by' => $user->id,
        ]);
    }

    public function createFromPngUpload(UploadedFile $file, User $user): IconAsset
    {
        $media = $this->uploads->storeUploadedFile($user, $file, 'icon');

        return IconAsset::create([
            'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) ?: 'icon',
            'format' => 'png',
            'svg' => null,
            'media_id' => $media->id,
            'source' => 'upload',
            'uploaded_by' => $user->id,
        ]);
    }

    public function createFromMedia(Media $media, User $user): IconAsset
    {
        if ($media->status !== MediaStatus::Ready) {
            throw ValidationException::withMessages([
                'media_uuid' => ['Медиафайл ещё не готов.'],
            ]);
        }

        if (IconAsset::query()->where('media_id', $media->id)->exists()) {
            throw ValidationException::withMessages([
                'media_uuid' => ['Этот медиафайл уже добавлен в библиотеку иконок.'],
            ]);
        }

        $mime = (string) $media->mime_type;
        $name = pathinfo((string) $media->filename, PATHINFO_FILENAME) ?: 'icon';

        if ($mime === 'image/png') {
            return IconAsset::create([
                'name' => $name,
                'format' => 'png',
                'svg' => null,
                'media_id' => $media->id,
                'source' => 'media',
                'uploaded_by' => $user->id,
            ]);
        }

        if ($mime === 'image/svg+xml') {
            $raw = $this->readMediaContents($media);

            return $this->createFromSvgString($raw, $name, $user, $media);
        }

        throw ValidationException::withMessages([
            'media_uuid' => ['Для иконки подходят только PNG или SVG.'],
        ]);
    }

    /** @return array<string, mixed> */
    public function toApiArray(IconAsset $asset): array
    {
        $asset->loadMissing('media');

        return [
            'id' => (string) $asset->id,
            'name' => $asset->name,
            'format' => $asset->format,
            'svg' => $asset->svg,
            'url' => $asset->format === 'png' ? $asset->media?->url : null,
            'mediaUuid' => $asset->media?->uuid,
            'createdAt' => $asset->created_at?->toIso8601String(),
        ];
    }

    private function readMediaContents(Media $media): string
    {
        if (! Storage::disk($media->disk)->exists($media->path)) {
            throw ValidationException::withMessages([
                'media_uuid' => ['Файл не найден в хранилище.'],
            ]);
        }

        return (string) Storage::disk($media->disk)->get($media->path);
    }
}
