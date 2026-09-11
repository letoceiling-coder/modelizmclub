<?php

namespace Modules\Media\Services;

use App\Models\Media;
use GdImage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
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

    /**
     * Дописать AVIF к уже готовым вариантам, не трогая WebP и JPEG.
     *
     * Для 322 медиа, которые получили варианты раньше, чем появился
     * кодировщик. Полная пересборка через `process()` тоже дала бы AVIF, но
     * заново перекодировала бы WebP и JPEG — втрое больше работы процессора
     * и перезапись файлов, которые браузеры держат в кеше как `immutable`
     * на год. Здесь существующие файлы не открываются вовсе: скачивается
     * исходник, режется в те же размеры той же функцией и сжимается только
     * в AVIF.
     *
     * Возвращает `added`, `skipped` (AVIF уже есть или медиа не картинка),
     * `failed` или `unsupported` (кодировщика нет).
     */
    public function addAvif(Media $media): string
    {
        if (! $this->avifSupported()) {
            return 'unsupported';
        }

        $stored = $media->variants;

        if (! is_array($stored) || $stored === [] || ! $this->shouldProcess($media)) {
            return 'skipped';
        }

        $missing = [];

        foreach (config('media.variants.sizes', []) as $name => $maxSide) {
            if (is_array($stored[$name] ?? null) && empty($stored[$name]['avif']['path'])) {
                $missing[(string) $name] = (int) $maxSide;
            }
        }

        if ($missing === []) {
            return 'skipped';
        }

        $tmp = $this->downloadToTemp($media);

        if ($tmp === null) {
            return 'failed';
        }

        try {
            $info = @getimagesize($tmp);

            if (! is_array($info) || ($info[0] ?? 0) < 1 || ($info[1] ?? 0) < 1) {
                return 'failed';
            }

            if (((int) $info[0] * (int) $info[1]) > ((int) config('media.variants.max_megapixels', 40) * 1_000_000)) {
                return 'skipped';
            }

            $source = $this->loadGd($tmp, (string) ($info['mime'] ?? $media->mime_type));

            if ($source === null) {
                return 'failed';
            }

            $oriented = $this->applyOrientation($source, $tmp);
            if ($oriented !== $source) {
                imagedestroy($source);
                $source = $oriented;
            }

            $srcW = imagesx($source);
            $srcH = imagesy($source);
            $dir = $this->variantDirectory($media);
            $added = [];

            foreach ($missing as $name => $maxSide) {
                $frame = $this->resize($source, $srcW, $srcH, $maxSide);
                $avif = $this->encodeFormat($media, $dir, $name, 'avif', $frame);
                imagedestroy($frame);

                if ($avif !== null) {
                    $added[$name] = $avif;
                }
            }

            imagedestroy($source);

            if ($added === []) {
                return 'failed';
            }

            // Перечитываем перед записью: пока кодировали, очередь могла
            // пересобрать варианты целиком. Дописываем только свои ключи.
            $fresh = $media->fresh();
            $variants = is_array($fresh?->variants) ? $fresh->variants : $stored;

            foreach ($added as $name => $avif) {
                if (is_array($variants[$name] ?? null)) {
                    $variants[$name]['avif'] = $avif;
                }
            }

            $media->variants = $variants;
            $media->save();

            return 'added';
        } catch (Throwable $e) {
            Log::error('media_avif_backfill_failed', [
                'media_uuid' => $media->uuid,
                'exception' => $e->getMessage(),
            ]);

            return 'failed';
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
            // Кодировщик выбирается здесь, а не в очереди: у задачи один вход
            // — кадр GD, — и ей всё равно, кто его сожмёт.
            if ($this->avifEncoder() === 'gd') {
                $ok = imageavif($frame, null, $quality, (int) config('media.variants.avif.speed', 7));
            } else {
                ob_end_clean();

                return $this->encodeAvifWithCli($frame, $quality);
            }
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

    /**
     * Есть ли чем кодировать AVIF.
     *
     * Два пути, и первый — встроенный. `imageavif` появляется, только если
     * libgd собрана с libavif, а Ubuntu-шный libgd3 (2.3.3-9ubuntu5) собран с
     * libheif и без неё: на проде 11.09 `function_exists('imageavif')` —
     * false, `gd_info()['AVIF Support']` — false, и за два месяца ни одно из
     * 322 медиа не получило AVIF-вариант. Код при этом молча пропускал формат,
     * так что снаружи это выглядело как «AVIF есть, просто не нужен».
     *
     * Второй путь — `avifenc` из пакета libavif-bin. Кадр уходит ему через
     * временный PNG. Качество и скорость те же, что у встроенного: оба —
     * libavif, и выигрыш −27 % к WebP измерен именно этим бинарником при
     * `-q 58`.
     */
    public function avifSupported(): bool
    {
        if (! (bool) config('media.variants.avif.enabled', true)) {
            return false;
        }

        return function_exists('imageavif') || $this->avifencBinary() !== null;
    }

    /** Какой кодировщик сработает — для команды и журналов. */
    public function avifEncoder(): ?string
    {
        if (! $this->avifSupported()) {
            return null;
        }

        $prefer = (string) config('media.variants.avif.prefer', 'auto');

        if ($prefer === 'avifenc' && $this->avifencBinary() !== null) {
            return 'avifenc';
        }

        return function_exists('imageavif') ? 'gd' : 'avifenc';
    }

    private ?string $avifenc = null;

    private bool $avifencResolved = false;

    private function avifencBinary(): ?string
    {
        if ($this->avifencResolved) {
            return $this->avifenc;
        }

        $this->avifencResolved = true;
        $configured = (string) config('media.variants.avif.avifenc', 'avifenc');

        if ($configured === '') {
            return $this->avifenc = null;
        }

        if (str_contains($configured, '/')) {
            return $this->avifenc = is_executable($configured) ? $configured : null;
        }

        $found = trim((string) @shell_exec('command -v '.escapeshellarg($configured).' 2>/dev/null'));

        return $this->avifenc = ($found !== '' && is_executable($found)) ? $found : null;
    }

    /**
     * Кадр → временный PNG → avifenc → байты AVIF.
     *
     * PNG, а не JPEG: промежуточный файл не должен терять качество до того,
     * как его сожмут, и должен сохранить прозрачность. Один поток (`-j 1`) —
     * воркер медиа и так работает с `Nice=10`, и занимать все четыре ядра
     * сервера ради фоновой задачи незачем.
     */
    private function encodeAvifWithCli(GdImage $frame, int $quality): ?string
    {
        $binary = $this->avifencBinary();

        if ($binary === null) {
            return null;
        }

        $in = tempnam(sys_get_temp_dir(), 'avif-in-');
        $out = tempnam(sys_get_temp_dir(), 'avif-out-');

        if ($in === false || $out === false) {
            return null;
        }

        $png = $in.'.png';
        $avif = $out.'.avif';
        @unlink($in);
        @unlink($out);

        try {
            imagesavealpha($frame, true);

            if (! imagepng($frame, $png, 1)) {
                return null;
            }

            $process = new Process([
                $binary,
                '-q', (string) $quality,
                '--speed', (string) (int) config('media.variants.avif.speed', 7),
                '-j', (string) max(1, (int) config('media.variants.avif.threads', 1)),
                $png,
                $avif,
            ]);
            $process->setTimeout((int) config('media.variants.avif.timeout', 60));
            $process->run();

            if (! $process->isSuccessful() || ! is_file($avif)) {
                Log::warning('media_avif_encode_failed', [
                    'exit' => $process->getExitCode(),
                    'stderr' => mb_substr($process->getErrorOutput(), 0, 300),
                ]);

                return null;
            }

            $body = file_get_contents($avif);

            return is_string($body) && $body !== '' ? $body : null;
        } finally {
            @unlink($png);
            @unlink($avif);
        }
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
