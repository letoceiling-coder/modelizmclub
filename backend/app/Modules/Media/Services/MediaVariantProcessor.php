<?php

namespace Modules\Media\Services;

use App\Models\Media;
use GdImage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaVariantProcessor
{
    /**
     * Build display variants. Never overwrites the original object.
     */
    public function process(Media $media): void
    {
        if (! config('media.variants.enabled', true)) {
            return;
        }

        if (! $this->shouldProcess($media)) {
            return;
        }

        $tmp = $this->downloadToTemp($media);

        if ($tmp === null) {
            return;
        }

        try {
            $info = @getimagesize($tmp);

            if (! is_array($info) || ($info[0] ?? 0) < 1 || ($info[1] ?? 0) < 1) {
                return;
            }

            $width = (int) $info[0];
            $height = (int) $info[1];
            $maxMp = (int) config('media.variants.max_megapixels', 40);

            if (($width * $height) > ($maxMp * 1_000_000)) {
                Log::warning('media_heavy', [
                    'reason' => 'megapixels',
                    'media_uuid' => $media->uuid,
                    'width' => $width,
                    'height' => $height,
                ]);

                return;
            }

            $source = $this->loadGd($tmp, (string) ($info['mime'] ?? $media->mime_type));

            if ($source === null) {
                return;
            }

            $oriented = $this->applyOrientation($source, $tmp);
            if ($oriented !== $source) {
                imagedestroy($source);
                $source = $oriented;
            }

            $srcW = imagesx($source);
            $srcH = imagesy($source);
            $variants = [];
            $dir = $this->variantDirectory($media);

            foreach (config('media.variants.sizes', []) as $name => $maxSide) {
                $frame = $this->resize($source, $srcW, $srcH, (int) $maxSide);
                $slot = $this->encodeSlot($media, $dir, (string) $name, $frame);
                imagedestroy($frame);

                if ($slot !== []) {
                    $variants[$name] = $slot;
                }
            }

            imagedestroy($source);

            $media->variants = $variants === [] ? null : $variants;
            $media->save();
        } catch (Throwable $e) {
            Log::error('media_variants_failed', [
                'media_uuid' => $media->uuid,
                'exception' => $e->getMessage(),
            ]);
        } finally {
            @unlink($tmp);
        }
    }

    public function shouldProcess(Media $media): bool
    {
        $purpose = $media->purpose;
        $skip = config('media.variants.skip_purposes', []);

        if (in_array($purpose, $skip, true)) {
            return false;
        }

        $mime = strtolower((string) $media->mime_type);

        return in_array($mime, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], true);
    }

    /**
     * @return array<string, array{avif?: string, webp?: string, jpeg?: string}>
     */
    public static function publicUrls(Media $media): array
    {
        $stored = $media->variants;

        if (! is_array($stored) || $stored === []) {
            return [];
        }

        $out = [];

        foreach (array_keys(config('media.variants.sizes', [])) as $name) {
            $slot = $stored[$name] ?? null;

            if (! is_array($slot)) {
                continue;
            }

            $urls = [];
            $avifBytes = (int) ($slot['avif']['bytes'] ?? 0);
            $webpBytes = (int) ($slot['webp']['bytes'] ?? 0);
            $jpegBytes = (int) ($slot['jpeg']['bytes'] ?? 0);
            $candidates = array_values(array_filter([$webpBytes, $jpegBytes], static fn (int $b): bool => $b > 0));
            $smallestLossy = $candidates === [] ? PHP_INT_MAX : min($candidates);
            // Only advertise a modern format when it actually saves bytes —
            // an AVIF heavier than the WebP it replaces is a net loss.
            $includeAvif = ! empty($slot['avif']['path']) && $avifBytes > 0 && $avifBytes <= $smallestLossy;
            $includeWebp = ! empty($slot['webp']['path']) && ($jpegBytes === 0 || $webpBytes <= $jpegBytes);

            if ($includeAvif) {
                $urls['avif'] = $media->variantPublicUrl((string) $name, 'avif');
            }

            if ($includeWebp) {
                $urls['webp'] = $media->variantPublicUrl((string) $name, 'webp');
            }

            if (! empty($slot['jpeg']['path'])) {
                $urls['jpeg'] = $media->variantPublicUrl((string) $name, 'jpg');
            }

            if ($urls !== []) {
                $out[$name] = $urls;
            }
        }

        return $out;
    }

    public function variantStoragePath(Media $media, string $name, string $ext): ?string
    {
        $format = match ($ext) {
            'jpg' => 'jpeg',
            default => $ext,
        };

        $stored = $media->variants[$name][$format]['path'] ?? null;

        return is_string($stored) && $stored !== '' ? $stored : null;
    }

    private function downloadToTemp(Media $media): ?string
    {
        try {
            $contents = Storage::disk($media->disk)->get($media->path);
        } catch (Throwable) {
            return null;
        }

        if (! is_string($contents) || $contents === '') {
            return null;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'mvar');

        if ($tmp === false) {
            return null;
        }

        file_put_contents($tmp, $contents);

        return $tmp;
    }

    private function loadGd(string $path, string $mime): ?GdImage
    {
        $image = match (strtolower($mime)) {
            'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default => false,
        };

        return $image instanceof GdImage ? $image : null;
    }

    private function applyOrientation(GdImage $image, string $path): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($path);
        $orientation = (int) ($exif['Orientation'] ?? 1);
        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => false,
        };

        return $rotated instanceof GdImage ? $rotated : $image;
    }

    private function resize(GdImage $source, int $srcW, int $srcH, int $maxSide): GdImage
    {
        $long = max($srcW, $srcH);

        if ($long <= $maxSide) {
            $copy = imagecreatetruecolor($srcW, $srcH);
            $this->fillTransparent($copy);
            imagecopy($copy, $source, 0, 0, 0, 0, $srcW, $srcH);

            return $copy;
        }

        $scale = $maxSide / $long;
        $dstW = max(1, (int) round($srcW * $scale));
        $dstH = max(1, (int) round($srcH * $scale));
        $copy = imagecreatetruecolor($dstW, $dstH);
        $this->fillTransparent($copy);
        imagecopyresampled($copy, $source, 0, 0, 0, 0, $dstW, $dstH, $srcW, $srcH);

        return $copy;
    }

    private function fillTransparent(GdImage $image): void
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefill($image, 0, 0, $transparent);
        imagealphablending($image, true);
    }

    /**
     * @return array<string, array{path: string, bytes: int, quality: int}>
     */
    private function encodeSlot(Media $media, string $dir, string $name, GdImage $frame): array
    {
        $slot = [];
        $jpeg = $this->encodeFormat($media, $dir, $name, 'jpeg', $frame);

        if ($jpeg !== null) {
            $slot['jpeg'] = $jpeg;
        }

        if (function_exists('imagewebp')) {
            $webp = $this->encodeFormat($media, $dir, $name, 'webp', $frame);

            if ($webp !== null) {
                $slot['webp'] = $webp;
            }
        }

        if ($this->avifSupported()) {
            $avif = $this->encodeFormat($media, $dir, $name, 'avif', $frame);

            if ($avif !== null) {
                $slot['avif'] = $avif;
            }
        }

        return $slot;
    }

    /**
     * @return array{path: string, bytes: int, quality: int}|null
     */
    private function encodeFormat(Media $media, string $dir, string $name, string $format, GdImage $frame): ?array
    {
        $singlePass = $format === 'avif';
        $qStart = $singlePass
            ? (int) config('media.variants.avif.quality', 58)
            : (int) config('media.variants.q_start', 84);
        $qMin = $singlePass ? $qStart : (int) config('media.variants.q_min', 76);
        $qStep = (int) config('media.variants.q_step', 4);
        $budget = (int) (config("media.variants.budgets.{$name}.{$format}") ?? 0);
        $ext = match ($format) {
            'webp' => 'webp',
            'avif' => 'avif',
            default => 'jpg',
        };
        $path = $dir.'/'.$name.'.'.$ext;

        $quality = $qStart;
        $best = null;

        while ($quality >= $qMin) {
            $encoded = $this->encodeBytes($frame, $format, $quality);

            if ($encoded === null) {
                return $best;
            }

            $best = ['body' => $encoded, 'quality' => $quality, 'bytes' => strlen($encoded)];

            if ($budget <= 0 || strlen($encoded) <= $budget) {
                break;
            }

            $quality -= max(1, $qStep);
        }

        if ($best === null) {
            return null;
        }

        if ($budget > 0 && $best['bytes'] > $budget) {
            Log::warning('media_heavy', [
                'media_uuid' => $media->uuid,
                'variant' => $name,
                'format' => $format,
                'bytes' => $best['bytes'],
                'budget' => $budget,
                'quality' => $best['quality'],
            ]);
        }

        Storage::disk($media->disk)->put($path, $best['body'], ['visibility' => 'public']);

        return [
            'path' => $path,
            'bytes' => $best['bytes'],
            'quality' => $best['quality'],
        ];
    }

    private function encodeBytes(GdImage $frame, string $format, int $quality): ?string
    {
        ob_start();

        if ($format === 'webp') {
            $ok = imagewebp($frame, null, $quality);
        } elseif ($format === 'avif') {
            $ok = imageavif($frame, null, $quality, (int) config('media.variants.avif.speed', 7));
        } else {
            $jpeg = $this->flattenForJpeg($frame);
            $ok = imagejpeg($jpeg, null, $quality);
            if ($jpeg !== $frame) {
                imagedestroy($jpeg);
            }
        }

        $body = ob_get_clean();

        if (! $ok || ! is_string($body) || $body === '') {
            return null;
        }

        return $body;
    }

    private function avifSupported(): bool
    {
        return (bool) config('media.variants.avif.enabled', true) && function_exists('imageavif');
    }

    private function flattenForJpeg(GdImage $frame): GdImage
    {
        $w = imagesx($frame);
        $h = imagesy($frame);
        $flat = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($flat, 255, 255, 255);
        imagefill($flat, 0, 0, $white);
        imagecopy($flat, $frame, 0, 0, 0, 0, $w, $h);

        return $flat;
    }

    private function variantDirectory(Media $media): string
    {
        $dir = pathinfo($media->path, PATHINFO_DIRNAME);
        $stem = pathinfo($media->path, PATHINFO_FILENAME);

        return trim($dir.'/'.$stem, '/');
    }
}
