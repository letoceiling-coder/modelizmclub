<?php

namespace App\Console\Commands;

use App\Enums\ContentStatus;
use App\Models\Media;
use App\Models\Post;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Modules\Feed\Support\PostMediaSync;
use Modules\Media\Services\MediaUploadService;

/**
 * Attaches a generated cover image to feed posts that have no media yet,
 * using the real upload pipeline (S3 Media + PostMedia) so the images are
 * served exactly like user-uploaded ones. Seeded demo posts ship without
 * photos; this gives the feed visual parity with the original template.
 */
class AttachPostPhotosCommand extends Command
{
    protected $signature = 'feed:attach-photos
        {--all : Attach to every published post, even those that already have media}
        {--limit=0 : Maximum number of posts to process (0 = no limit)}
        {--width=1200 : Cover width in px}
        {--height=800 : Cover height in px}
        {--dry-run : Report what would change without writing}';

    protected $description = 'Attach a generated cover photo to feed posts that have none.';

    public function handle(MediaUploadService $media, PostMediaSync $sync): int
    {
        if (! \function_exists('imagecreatetruecolor')) {
            $this->error('GD extension is not available — cannot generate images.');

            return self::FAILURE;
        }

        $w = max(320, (int) $this->option('width'));
        $h = max(240, (int) $this->option('height'));
        $limit = max(0, (int) $this->option('limit'));
        $dry = (bool) $this->option('dry-run');

        $query = Post::query()
            ->where('status', ContentStatus::Published)
            ->with('author');

        if (! $this->option('all')) {
            $query->doesntHave('mediaItems');
        }

        $query->orderBy('id');
        if ($limit > 0) {
            $query->limit($limit);
        }

        $posts = $query->get();

        if ($posts->isEmpty()) {
            $this->info('Нет постов, требующих фото. Всё уже с изображениями.');

            return self::SUCCESS;
        }

        $this->info(($dry ? '[dry-run] ' : '').'Постов к обработке: '.$posts->count()." ({$w}×{$h})");
        $bar = $this->output->createProgressBar($posts->count());
        $bar->start();

        $ok = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($posts as $post) {
            $author = $post->author;
            if (! $author) {
                $skipped++;
                $bar->advance();

                continue;
            }

            if ($dry) {
                $ok++;
                $bar->advance();

                continue;
            }

            $path = $this->generateCover((string) ($post->title ?: 'ModelizmClub'), $w, $h);
            try {
                $file = new UploadedFile($path, 'cover.jpg', 'image/jpeg', null, true);
                $asset = $media->storeUploadedFile($author, $file, 'post');

                if (! $asset instanceof Media) {
                    $failed++;

                    continue;
                }

                $sync->sync($post, $author, [$asset->uuid]);
                $ok++;
            } catch (\Throwable $e) {
                $failed++;
                $this->newLine();
                $this->warn("Пост #{$post->id}: {$e->getMessage()}");
            } finally {
                @unlink($path);
                $bar->advance();
            }
        }

        $bar->finish();
        $this->newLine(2);
        $this->table(['Прикреплено', 'Пропущено', 'Ошибок'], [[$ok, $skipped, $failed]]);

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /** Generate a tasteful gradient cover with the post title and return its temp path. */
    private function generateCover(string $title, int $w, int $h): string
    {
        $img = imagecreatetruecolor($w, $h);

        // Deterministic palette per title so re-runs look stable and varied.
        $seed = crc32($title);
        mt_srand($seed);
        $palettes = [
            [[31, 41, 71], [86, 60, 140]],
            [[17, 49, 60], [33, 120, 110]],
            [[60, 22, 38], [150, 60, 80]],
            [[20, 30, 48], [50, 90, 150]],
            [[40, 30, 20], [140, 95, 50]],
            [[24, 24, 28], [70, 70, 90]],
        ];
        [$c1, $c2] = $palettes[$seed % count($palettes)];

        for ($y = 0; $y < $h; $y++) {
            $t = $y / max(1, $h - 1);
            $r = (int) ($c1[0] + ($c2[0] - $c1[0]) * $t);
            $g = (int) ($c1[1] + ($c2[1] - $c1[1]) * $t);
            $b = (int) ($c1[2] + ($c2[2] - $c1[2]) * $t);
            $line = imagecolorallocate($img, $r, $g, $b);
            imageline($img, 0, $y, $w, $y, $line);
        }

        // Soft accent blobs for texture.
        for ($i = 0; $i < 4; $i++) {
            $blob = imagecolorallocatealpha(
                $img,
                min(255, $c2[0] + 40),
                min(255, $c2[1] + 40),
                min(255, $c2[2] + 40),
                90,
            );
            imagefilledellipse($img, mt_rand(0, $w), mt_rand(0, $h), mt_rand(200, 460), mt_rand(200, 460), $blob);
        }

        $white = imagecolorallocate($img, 255, 255, 255);
        $muted = imagecolorallocate($img, 220, 220, 230);
        $font = $this->ttfFont();

        if ($font !== null) {
            $this->drawWrappedTtf($img, $title, $font, $w, $h, $white);
            imagettftext($img, 18, 0, 40, $h - 40, $muted, $font, 'ModelizmClub');
        } else {
            // Bitmap-font fallback (no TTF installed).
            $lines = str_split($title, (int) max(10, ($w - 80) / 10));
            $y = (int) ($h / 2) - (count($lines) * 10);
            foreach (array_slice($lines, 0, 5) as $line) {
                imagestring($img, 5, 40, $y, $line, $white);
                $y += 22;
            }
            imagestring($img, 3, 40, $h - 30, 'ModelizmClub', $muted);
        }

        mt_srand();

        $base = tempnam(sys_get_temp_dir(), 'cover_');
        $path = $base.'.jpg';
        @unlink($base);
        imagejpeg($img, $path, 82);
        imagedestroy($img);

        return $path;
    }

    private function ttfFont(): ?string
    {
        if (! \function_exists('imagettftext')) {
            return null;
        }
        foreach ([
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        ] as $f) {
            if (is_file($f)) {
                return $f;
            }
        }

        return null;
    }

    private function drawWrappedTtf(\GdImage $img, string $title, string $font, int $w, int $h, int $color): void
    {
        $size = 44;
        $maxWidth = $w - 80;
        $words = preg_split('/\s+/', trim($title)) ?: [$title];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            $try = $current === '' ? $word : $current.' '.$word;
            $box = imagettfbbox($size, 0, $font, $try);
            if (($box[2] - $box[0]) > $maxWidth && $current !== '') {
                $lines[] = $current;
                $current = $word;
            } else {
                $current = $try;
            }
        }
        if ($current !== '') {
            $lines[] = $current;
        }
        $lines = array_slice($lines, 0, 4);

        $lineHeight = (int) ($size * 1.35);
        $y = (int) (($h - count($lines) * $lineHeight) / 2) + $size;
        foreach ($lines as $line) {
            imagettftext($img, $size, 0, 40, $y, $color, $font, $line);
            $y += $lineHeight;
        }
    }
}
