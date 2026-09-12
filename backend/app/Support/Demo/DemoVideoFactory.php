<?php

namespace App\Support\Demo;

use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Modules\Media\Services\MediaUploadService;

/**
 * Короткий демо-ролик через ffmpeg — по образцу `DemoImageFactory`.
 *
 * ПОЧЕМУ ffmpeg, А НЕ ГОТОВЫЙ ФАЙЛ В РЕПОЗИТОРИИ. Конвейер видео на сервере
 * сам считает длительность и собирает представления; готовый файл проверял бы
 * только загрузку. Ролик собирается из тестового источника ffmpeg: три
 * секунды, без звука, около сорока килобайт.
 *
 * ЕСЛИ ffmpeg НЕТ — возвращаем null, и запись создаётся без видео. Это лучше,
 * чем падение всего набора из-за одной необязательной части; команда
 * сообщает об этом в отчёте.
 */
final class DemoVideoFactory
{
    public static function available(): bool
    {
        $which = @shell_exec('command -v ffmpeg 2>/dev/null');

        return is_string($which) && trim($which) !== '';
    }

    public static function upload(User $user, MediaUploadService $uploads, string $label): ?Media
    {
        $path = self::createMp4($label);
        if ($path === null) {
            return null;
        }

        try {
            $file = new UploadedFile($path, 'demo.mp4', 'video/mp4', null, true);

            return $uploads->storeUploadedFile($user, $file, 'post_video', 3);
        } finally {
            @unlink($path);
        }
    }

    private static function createMp4(string $label): ?string
    {
        if (! self::available()) {
            return null;
        }

        $base = tempnam(sys_get_temp_dir(), 'demo_vid_');
        $path = $base.'.mp4';
        @unlink($base);

        // testsrc — встроенный генератор ffmpeg: цветные полосы со счётчиком
        // кадров. Ничего не читает с диска и не зависит от шрифтов.
        $cmd = sprintf(
            'ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=640x360:rate=15:duration=3 '.
            '-pix_fmt yuv420p -c:v libx264 -preset ultrafast -movflags +faststart -y %s 2>/dev/null',
            escapeshellarg($path),
        );
        @shell_exec($cmd);

        if (! is_file($path) || filesize($path) === 0) {
            @unlink($path);
            Log::warning('demo: ffmpeg не собрал ролик', ['label' => $label]);

            return null;
        }

        return $path;
    }
}
