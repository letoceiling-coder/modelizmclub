<?php

namespace Tests\Unit;

use Modules\Media\Services\MediaUploadService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * Расширение в пути объекта выводится из проверенного типа, не из имени файла.
 *
 * До 03.10 в запасной ветке стояло `getClientOriginalExtension()`, то есть
 * `pathinfo(..., PATHINFO_EXTENSION)` без фильтра. Сопоставления не было ровно
 * у одного разрешённого типа — `video/webm` — и валидный WebM с именем
 * `shell.php` сохранялся как `…/{uuid}.php`. Штатный замок Laravel
 * (`shouldBlockPhpUpload`) не срабатывал: он живёт внутри правил
 * `mimes:`/`mimetypes:`, которых на боевых точках приёма нет.
 *
 * Проверяем не один тот случай, а инвариант: у каждого типа, который загрузка
 * вообще принимает, есть своё расширение. Пока это так, запасная ветка
 * недостижима — и добавить в LIMITS новый тип, забыв про расширение, не
 * получится молча.
 */
class MediaUploadExtensionTest extends TestCase
{
    /** @return list<string> */
    private function разрешённыеТипы(): array
    {
        $limits = (new ReflectionClass(MediaUploadService::class))->getConstant('LIMITS');

        $типы = [];
        foreach ($limits as $назначение) {
            foreach ($назначение['mimes'] as $mime) {
                $типы[] = $mime;
            }
        }

        return array_values(array_unique($типы));
    }

    private function расширениеДля(string $mime): ?string
    {
        $метод = (new ReflectionClass(MediaUploadService::class))->getMethod('extensionForMime');
        $метод->setAccessible(true);

        return $метод->invoke(
            (new ReflectionClass(MediaUploadService::class))->newInstanceWithoutConstructor(),
            $mime,
        );
    }

    public function test_every_accepted_mime_maps_to_an_extension(): void
    {
        $типы = $this->разрешённыеТипы();
        $this->assertNotEmpty($типы, 'LIMITS прочитался пустым — проверка не выполнялась.');

        $без = [];
        foreach ($типы as $mime) {
            if ($this->расширениеДля($mime) === null) {
                $без[] = $mime;
            }
        }

        $this->assertSame([], $без, 'Типы без расширения роняют путь в запасную ветку: '.implode(', ', $без));
    }

    public function test_webm_video_maps_to_webm(): void
    {
        // Тот самый пробел: libmagic называет `video/webm` и настоящее видео,
        // и голосовую запись браузера.
        $this->assertSame('webm', $this->расширениеДля('video/webm'));
    }

    public function test_an_unknown_mime_has_no_extension_of_its_own(): void
    {
        // Запасная ветка подставляет `bin`; главное, что она не спрашивает
        // клиентское имя.
        $this->assertNull($this->расширениеДля('application/x-httpd-php'));
    }
}
