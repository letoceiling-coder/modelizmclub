<?php

namespace Tests\Support;

/**
 * Правдоподобные байты для тестов загрузки.
 *
 * С 03.10 `MediaUploadService::confirm` определяет тип по содержимому
 * объекта, а не по тому, что заявил клиент. Строка `'fake-image'` в бакете
 * опознаётся как `text/plain` и подтверждение не проходит — и это верно: ровно
 * так работала дыра, когда под заявленным `image/png` лежало что угодно.
 *
 * Поэтому тестам нужны настоящие сигнатуры. Полноценные файлы не требуются:
 * finfo читает формат по началу, и заголовка достаточно.
 */
final class FakeMediaBytes
{
    public static function jpeg(): string
    {
        return "\xFF\xD8\xFF\xE0".
            "\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00".
            str_repeat("\x00", 64).
            "\xFF\xD9";
    }

    /** Настоящий PNG 1×1, самый короткий возможный. */
    public static function png(): string
    {
        return (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
            true,
        );
    }

    public static function mp4(): string
    {
        return "\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41".str_repeat("\x00", 32);
    }

    /** EBML-заголовок с docType `webm`; finfo отвечает `video/webm`. */
    public static function webm(): string
    {
        return "\x1A\x45\xDF\xA3\x01\x00\x00\x00\x00\x00\x00\x23".
            "\x42\x86\x81\x01\x42\xF7\x81\x01\x42\xF2\x81\x04\x42\xF3\x81\x08".
            "\x42\x82\x84webm".
            str_repeat("\x00", 32);
    }

    public static function pdf(): string
    {
        return "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n";
    }

    /** Для проверок «содержимое не совпадает с заявленным». */
    public static function garbage(): string
    {
        return 'это просто текст, а не картинка';
    }
}
