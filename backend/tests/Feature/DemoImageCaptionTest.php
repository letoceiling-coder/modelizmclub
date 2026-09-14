<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\DemoImageFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Modules\Media\Services\MediaUploadService;
use Tests\TestCase;

/**
 * Подпись демо-картинок: кириллица рисуется глифами, а не байтами UTF-8.
 *
 * До 15.09 `imagestring` выводил «Ж» как два латинских знака `Ð–`. Проверка
 * по ширине: тем же замером со старым кодом пять «Ж» выходят в 1,82 раза
 * шире пяти «W» (80 px против 44), с TTF — одного порядка.
 */
class DemoImageCaptionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);
        Queue::fake();
    }

    public function test_кириллическая_буква_занимает_одно_знакоместо(): void
    {
        // Растровый шрифт без кириллицы рисует «Ж» двумя знаками `Ð–` —
        // строка из пяти «Ж» выходит вдвое шире пяти «W». У TTF-шрифта
        // ширины одного порядка.
        $cyr = $this->captionWidth('ЖЖЖЖЖ');
        $lat = $this->captionWidth('WWWWW');
        $digits = $this->captionWidth('88888');

        $this->assertLessThan(1.4, $cyr / $lat, "Ж×5 = {$cyr}px, W×5 = {$lat}px");
        $this->assertGreaterThan(0.6, $cyr / $lat);
        $this->assertGreaterThan(0, $digits);
    }

    public function test_кириллица_латиница_и_цифры_дают_разные_глифы(): void
    {
        $hashes = [];
        foreach (['Ж', 'Ш', 'Z', '7', '?'] as $char) {
            $hashes[$char] = md5($this->render($char));
        }

        $this->assertCount(5, array_unique($hashes), 'у каждого знака свой глиф');
    }

    private function render(string $title): string
    {
        $img = imagecreatetruecolor(600, 120);
        imagefilledrectangle($img, 0, 0, 600, 120, imagecolorallocate($img, 40, 40, 40));
        DemoImageFactory::drawCaption($img, $title, '');
        ob_start();
        imagepng($img);
        $png = (string) ob_get_clean();
        imagedestroy($img);

        return $png;
    }

    /** Ширина белого текста в пикселях: от первого до последнего светлого столбца. */
    private function captionWidth(string $title): int
    {
        $img = imagecreatefromstring($this->render($title));
        $min = PHP_INT_MAX;
        $max = -1;
        for ($x = 0; $x < imagesx($img); $x++) {
            for ($y = 0; $y < imagesy($img); $y++) {
                $rgb = imagecolorat($img, $x, $y);
                if ((($rgb >> 16) & 0xFF) > 200) {
                    $min = min($min, $x);
                    $max = max($max, $x);
                    break;
                }
            }
        }
        imagedestroy($img);

        return $max < 0 ? 0 : $max - $min + 1;
    }

    public function test_картинка_собирается_в_заданном_размере(): void
    {
        $path = DemoImageFactory::createJpeg('Вертолёты — обзор 1 · LEGO 31313 · 1 500 ₽', 256, 256);

        try {
            [$w, $h, $type] = getimagesize($path);
            $this->assertSame([256, 256, IMAGETYPE_JPEG], [$w, $h, $type]);
        } finally {
            @unlink($path);
        }
    }

    public function test_перегенерация_переставляет_ссылки_и_удаляет_старую(): void
    {
        $user = User::factory()->create();
        $uploads = app(MediaUploadService::class);

        $old = DemoImageFactory::upload($user, $uploads, 'Avatar: Андрей', 'avatar');
        UserProfile::query()->create(['user_id' => $user->id, 'display_name' => 'Андрей Лебедев', 'slug' => 'andrei-test', 'avatar_media_id' => $old->id]);
        $orphan = DemoImageFactory::upload($user, $uploads, 'Никому не нужна', 'banner');

        $this->artisan('demo:regenerate-images', ['--dry-run' => true])
            ->expectsOutputToContain('со ссылками: 1; без ссылок (не трогаем): 1')
            ->assertSuccessful();
        $this->assertNotNull(Media::query()->find($old->id), 'сухой прогон ничего не меняет');

        $this->artisan('demo:regenerate-images', ['--pause' => 0])->assertSuccessful();

        $newId = UserProfile::query()->where('user_id', $user->id)->value('avatar_media_id');
        $new = Media::query()->findOrFail($newId);
        $this->assertNotSame($old->id, $new->id);
        $this->assertSame('ttf', $new->metadata['caption'] ?? null);
        $this->assertSame($old->uuid, $new->metadata['replaces'] ?? null);
        $this->assertSame('avatar', $new->purpose);
        Storage::disk('s3')->assertExists($new->path);

        $this->assertNull(Media::query()->find($old->id));
        Storage::disk('s3')->assertMissing($old->path);

        $this->assertNotNull(Media::query()->find($orphan->id), 'картинку без ссылок не трогаем');

        $this->artisan('demo:regenerate-images', ['--dry-run' => true])
            ->expectsOutputToContain('в этот запуск: 0')
            ->assertSuccessful();
    }
}
