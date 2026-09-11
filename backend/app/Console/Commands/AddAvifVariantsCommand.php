<?php

namespace App\Console\Commands;

use App\Enums\MediaStatus;
use App\Models\Media;
use Illuminate\Console\Command;
use Modules\Media\Services\MediaVariantProcessor;

/**
 * Дописать AVIF к вариантам медиа, которые собирались без него.
 *
 * До 11.09 на проде не было кодировщика AVIF, и ни одно из 322 медиа его не
 * получило. Эта команда догоняет их по одному: скачивает исходник, режет в
 * те же четыре размера и сжимает только в AVIF. WebP и JPEG не трогаются —
 * ни байты, ни адреса, — поэтому то, что уже лежит в кешах браузеров и
 * nginx, остаётся верным.
 *
 * Идёт в процессе команды, а не через очередь, намеренно: так видно
 * прогресс, и темп задаёт `--sleep`, а не воркер, который взял бы задачи
 * подряд. Запускать с пониженным приоритетом:
 *
 *   nice -n 19 php artisan media:add-avif --sleep=2
 *
 * Повторный запуск безопасен: медиа, у которых AVIF уже есть, пропускаются.
 * Прерванный запуск продолжается с того же места.
 */
class AddAvifVariantsCommand extends Command
{
    protected $signature = 'media:add-avif
        {--limit=0 : Сколько медиа обработать за запуск, 0 — все}
        {--sleep=2 : Пауза между медиа, секунд}
        {--dry-run : Только посчитать, ничего не кодировать}';

    protected $description = 'Дописать AVIF к готовым вариантам медиа, не трогая WebP и JPEG';

    public function handle(MediaVariantProcessor $processor): int
    {
        $limit = max(0, (int) $this->option('limit'));
        $sleepMs = (int) round(max(0.0, (float) $this->option('sleep')) * 1000);
        $dryRun = (bool) $this->option('dry-run');

        $candidates = $this->candidates($processor);
        $total = $limit > 0 ? min($limit, count($candidates)) : count($candidates);
        $frames = array_sum(array_map(static fn (array $c): int => $c['missing'], array_slice($candidates, 0, $total)));

        $encoder = $processor->avifEncoder();
        $this->line('Кодировщик: '.($encoder ?? 'нет'));
        $this->line("Медиа без AVIF: {$total}, кадров к сжатию: {$frames}");

        if ($dryRun) {
            $this->info('Пробный прогон: ничего не кодируется.');

            return self::SUCCESS;
        }

        if ($encoder === null) {
            $this->error('Кодировать AVIF нечем: нет ни imageavif в GD, ни avifenc. См. config/media.php, variants.avif.');

            return self::FAILURE;
        }

        if ($total === 0) {
            $this->info('Догонять нечего.');

            return self::SUCCESS;
        }

        $counts = ['added' => 0, 'skipped' => 0, 'failed' => 0];
        $started = microtime(true);
        $bar = $this->output->createProgressBar($total);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%%  %elapsed:6s% / ~%estimated:-6s%  %message%');
        $bar->setMessage('');
        $bar->start();

        foreach (array_slice($candidates, 0, $total) as $index => $candidate) {
            if ($index > 0 && $sleepMs > 0) {
                usleep($sleepMs * 1000);
            }

            $media = Media::query()->find($candidate['id']);
            $result = $media === null ? 'skipped' : $processor->addAvif($media);
            $counts[$result === 'unsupported' ? 'failed' : $result]++;

            $bar->setMessage("+{$counts['added']} пропуск {$counts['skipped']} сбой {$counts['failed']}");
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $seconds = microtime(true) - $started;
        $this->info(sprintf(
            'Готово за %d с: добавлено %d, пропущено %d, сбоев %d.',
            (int) round($seconds),
            $counts['added'],
            $counts['skipped'],
            $counts['failed'],
        ));

        return $counts['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Медиа, у которых есть варианты, но не у всех размеров есть AVIF.
     *
     * @return list<array{id: int, missing: int}>
     */
    private function candidates(MediaVariantProcessor $processor): array
    {
        $out = [];
        $sizes = array_keys(config('media.variants.sizes', []));

        Media::query()
            ->where('status', MediaStatus::Ready)
            ->whereNotNull('variants')
            ->orderBy('id')
            ->chunkById(200, function ($rows) use (&$out, $processor, $sizes): void {
                foreach ($rows as $media) {
                    $variants = $media->variants;

                    if (! is_array($variants) || $variants === [] || ! $processor->shouldProcess($media)) {
                        continue;
                    }

                    $missing = 0;

                    foreach ($sizes as $name) {
                        if (is_array($variants[$name] ?? null) && empty($variants[$name]['avif']['path'])) {
                            $missing++;
                        }
                    }

                    if ($missing > 0) {
                        $out[] = ['id' => (int) $media->id, 'missing' => $missing];
                    }
                }
            });

        return $out;
    }
}
