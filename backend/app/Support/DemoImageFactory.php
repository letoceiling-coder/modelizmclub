<?php

namespace App\Support;

use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Modules\Media\Services\MediaUploadService;

/**
 * Generates deterministic demo JPEGs and uploads them through the normal media pipeline.
 */
class DemoImageFactory
{
    public static function upload(User $user, MediaUploadService $uploads, string $label, string $purpose): Media
    {
        $path = self::createJpeg($label);

        try {
            $file = new UploadedFile($path, 'demo.jpg', 'image/jpeg', null, true);

            return $uploads->storeUploadedFile($user, $file, $purpose);
        } finally {
            @unlink($path);
        }
    }

    /** @return non-empty-string */
    public static function createJpeg(string $label, int $width = 900, int $height = 675): string
    {
        $img = imagecreatetruecolor($width, $height);
        $hash = crc32($label);

        $bg = imagecolorallocate(
            $img,
            (($hash >> 16) & 0x7f) + 40,
            (($hash >> 8) & 0x7f) + 40,
            ($hash & 0x7f) + 40,
        );
        imagefilledrectangle($img, 0, 0, $width, $height, $bg);

        for ($i = 0; $i < 8; $i++) {
            $step = ($hash >> ($i * 3)) & 0xff;
            $color = imagecolorallocate($img, ($step + 40) % 256, ($step + 90) % 256, ($step + 140) % 256);
            imagefilledellipse(
                $img,
                ($step * 17 + $i * 73) % max(1, $width - 1),
                ($step * 23 + $i * 41) % max(1, $height - 1),
                80 + ($step % 160),
                60 + ($step % 120),
                $color,
            );
        }

        $fg = imagecolorallocate($img, 255, 255, 255);
        imagestring($img, 5, 24, 24, mb_substr($label, 0, 40), $fg);
        imagestring($img, 3, 24, 52, 'ModelizmClub demo', $fg);

        $base = tempnam(sys_get_temp_dir(), 'demo_img_');
        $path = $base.'.jpg';
        @unlink($base);
        imagejpeg($img, $path, 78);
        imagedestroy($img);

        return $path;
    }
}
