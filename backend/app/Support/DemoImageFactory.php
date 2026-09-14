<?php

namespace App\Support;

use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Modules\Media\Services\MediaUploadService;
use RuntimeException;

/**
 * Generates deterministic demo JPEGs and uploads them through the normal media pipeline.
 *
 * Подпись рисуется TTF-шрифтом через `imagettftext`. До 15.09 здесь стоял
 * `imagestring` — встроенный растровый шрифт GD, в котором нет кириллицы:
 * он выводит байты UTF-8 по одному, и «Демонстрационная запись» превращалась
 * в `Ð”ÐµÐ¼…` на 698 картинках прода. Шрифт лежит в репозитории, а не берётся
 * из системы: на маке, в CI и на сервере наборы шрифтов разные, а подпись
 * должна выглядеть одинаково везде.
 */
class DemoImageFactory
{
    public const FONT = 'resources/fonts/DejaVuSans.ttf';

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
            (($hash >> 16) & 0x7F) + 40,
            (($hash >> 8) & 0x7F) + 40,
            ($hash & 0x7F) + 40,
        );
        imagefilledrectangle($img, 0, 0, $width, $height, $bg);

        for ($i = 0; $i < 8; $i++) {
            $step = ($hash >> ($i * 3)) & 0xFF;
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

        self::drawCaption($img, $label, 'ModelizmClub demo');

        $base = tempnam(sys_get_temp_dir(), 'demo_img_');
        $path = $base.'.jpg';
        @unlink($base);
        imagejpeg($img, $path, 78);
        imagedestroy($img);

        return $path;
    }

    /**
     * Подпись в левом верхнем углу: заголовок и строка поменьше под ним, на
     * полупрозрачной подложке — пятна фона бывают и светлыми, и белый текст
     * на них пропадал бы.
     *
     * Размер шрифта — от ширины картинки, чтобы на аватаре и на баннере
     * подпись занимала одинаковую долю. Длинный заголовок обрезается с
     * многоточием по ширине, а не по числу символов: «Ш» и «i» разной ширины.
     */
    public static function drawCaption(\GdImage $img, string $title, string $subtitle): void
    {
        $font = self::fontPath();
        $width = imagesx($img);
        $pad = max(12, (int) round($width * 0.027));
        $titleSize = max(10.0, round($width * 0.03, 1));
        $subSize = max(8.0, round($titleSize * 0.6, 1));
        $maxTextWidth = $width - $pad * 4;

        $title = self::fitToWidth(trim($title) === '' ? 'МоДелизМ' : trim($title), $font, $titleSize, $maxTextWidth);

        [$titleW, $titleH] = self::textBox($font, $titleSize, $title);
        [$subW, $subH] = self::textBox($font, $subSize, $subtitle);
        $gap = (int) round($subH * 0.6);

        $boxW = max($titleW, $subW) + $pad * 2;
        $boxH = $titleH + $gap + $subH + $pad * 2;
        $shade = imagecolorallocatealpha($img, 0, 0, 0, 70);
        imagefilledrectangle($img, $pad, $pad, $pad + $boxW, $pad + $boxH, $shade);

        $white = imagecolorallocate($img, 255, 255, 255);
        $soft = imagecolorallocate($img, 225, 225, 225);
        // imagettftext ставит текст по базовой линии, а не по верхнему краю.
        imagettftext($img, $titleSize, 0, $pad * 2, $pad * 2 + $titleH, $white, $font, $title);
        imagettftext($img, $subSize, 0, $pad * 2, $pad * 2 + $titleH + $gap + $subH, $soft, $font, $subtitle);
    }

    public static function fontPath(): string
    {
        $path = base_path(self::FONT);

        if (! is_file($path)) {
            throw new RuntimeException("Нет шрифта для подписи демо-картинок: {$path}");
        }

        return $path;
    }

    /** @return array{0: int, 1: int} ширина и высота над базовой линией */
    private static function textBox(string $font, float $size, string $text): array
    {
        $box = imagettfbbox($size, 0, $font, $text);

        if ($box === false) {
            throw new RuntimeException('imagettfbbox не разобрал шрифт.');
        }

        // Высота — по заглавной «Ё»: у строки без выносных элементов bbox
        // ниже, и подложка прыгала бы от подписи к подписи.
        $cap = imagettfbbox($size, 0, $font, 'ЁЙ');

        return [abs($box[2] - $box[0]), abs(($cap[7] ?? 0) - ($cap[1] ?? 0))];
    }

    private static function fitToWidth(string $text, string $font, float $size, int $maxWidth): string
    {
        if (self::textBox($font, $size, $text)[0] <= $maxWidth) {
            return $text;
        }

        $chars = mb_str_split($text);

        while (count($chars) > 1) {
            array_pop($chars);
            $candidate = rtrim(implode('', $chars)).'…';

            if (self::textBox($font, $size, $candidate)[0] <= $maxWidth) {
                return $candidate;
            }
        }

        return '…';
    }
}
