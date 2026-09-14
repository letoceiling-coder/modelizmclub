<?php

namespace App\Console\Commands;

use App\Models\Media;
use App\Models\User;
use App\Support\DemoImageFactory;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Media\Services\MediaUploadService;
use Throwable;

/**
 * Перерисовать демо-картинки, у которых подпись набрана растровым шрифтом GD
 * без кириллицы (до 15.09 — 698 файлов на проде).
 *
 * ПОЧЕМУ НОВАЯ ЗАПИСЬ, А НЕ ПЕРЕЗАПИСЬ ФАЙЛА. Картинка отдаётся по адресу
 * с uuid: браузер держит её как `immutable` год, nginx — тридцать дней в
 * fastcgi-кеше. Перезаписанный на месте файл пользователи увидели бы через
 * месяц в лучшем случае. Поэтому рисуется новая картинка, загружается тем
 * же конвейером (новый uuid, свои варианты), все ссылки на старую запись
 * переставляются на новую в одной транзакции, и только после этого старые
 * файлы и строка удаляются.
 *
 * Какие картинки демо: `filename = demo.jpg` — так их называет
 * `DemoImageFactory::upload`, пользовательские загрузки носят имя файла с
 * устройства. Уже перерисованные помечены `metadata.caption = ttf` и
 * повторно не берутся, поэтому команду можно прерывать и запускать снова.
 *
 * Картинка без единой ссылки не трогается: её никто не видит, а удалять
 * чужое без причины команда не должна.
 */
class RegenerateDemoImagesCommand extends Command
{
    protected $signature = 'demo:regenerate-images
        {--dry-run : показать план, ничего не писать}
        {--purpose=* : только эти назначения (listing, post, avatar, cover, chat…)}
        {--limit=0 : не больше стольких картинок за запуск, 0 — все}
        {--batch=20 : сколько подряд без паузы}
        {--pause=2 : пауза между порциями, секунд}';

    protected $description = 'Перерисовать подписи демо-картинок TTF-шрифтом (кириллица) с заменой ссылок';

    /**
     * Все колонки, которые ссылаются на media.id. Сверено с
     * information_schema 15.09: ссылок по uuid в текстовых полях у демо-
     * картинок нет.
     *
     * @var list<array{0: string, 1: string}>
     */
    public const REFERENCES = [
        ['listing_media', 'media_id'],
        ['post_media', 'media_id'],
        ['channel_post_media', 'media_id'],
        ['comment_media', 'media_id'],
        ['message_attachments', 'media_id'],
        ['media_attachments', 'media_id'],
        ['media_transcripts', 'media_id'],
        ['user_profiles', 'avatar_media_id'],
        ['user_profiles', 'cover_media_id'],
        ['communities', 'avatar_media_id'],
        ['communities', 'cover_media_id'],
        ['channels', 'avatar_media_id'],
        ['channels', 'banner_media_id'],
        ['channel_applications', 'avatar_media_id'],
        ['channel_applications', 'banner_media_id'],
        ['banners', 'image_media_id'],
        ['club_events', 'cover_media_id'],
        ['videos', 'poster_media_id'],
        ['icon_assets', 'media_id'],
    ];

    public function handle(MediaUploadService $uploads): int
    {
        $dry = (bool) $this->option('dry-run');
        $purposes = array_filter((array) $this->option('purpose'));
        $limit = max(0, (int) $this->option('limit'));
        $batch = max(1, (int) $this->option('batch'));
        $pause = max(0, (int) $this->option('pause'));

        $query = Media::query()
            ->where('filename', 'demo.jpg')
            ->where('mime_type', 'image/jpeg')
            ->whereRaw("coalesce(metadata->>'caption', '') <> 'ttf'")
            ->orderBy('id');

        if ($purposes !== []) {
            $query->where(function ($q) use ($purposes): void {
                foreach ($purposes as $purpose) {
                    $q->orWhere('path', 'like', 'media/'.$purpose.'/%');
                }
            });
        }

        $ids = $query->pluck('id');
        $plan = [];
        $orphans = 0;

        foreach ($ids as $id) {
            $refs = $this->referencesTo((int) $id);
            if ($refs === []) {
                $orphans++;

                continue;
            }
            $plan[] = (int) $id;
        }

        if ($limit > 0) {
            $plan = array_slice($plan, 0, $limit);
        }

        $this->info(sprintf(
            'Демо-картинок со старой подписью: %d; со ссылками: %d; без ссылок (не трогаем): %d; в этот запуск: %d',
            $ids->count(),
            $ids->count() - $orphans,
            $orphans,
            count($plan),
        ));

        if ($dry) {
            foreach (array_slice($plan, 0, 10) as $id) {
                $media = Media::query()->find($id);
                $this->line(sprintf('  #%d %s → «%s»', $id, $media?->purpose, $this->labelFor($id)));
            }

            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar(count($plan));
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s% · ошибок: %message%');
        $bar->setMessage('0');
        $bar->start();

        $done = 0;
        $failed = 0;

        foreach ($plan as $i => $id) {
            try {
                $this->regenerate($id, $uploads);
                $done++;
            } catch (Throwable $e) {
                $failed++;
                $bar->setMessage((string) $failed);
                $this->newLine();
                $this->error("#{$id}: ".$e->getMessage());
                report($e);
            }

            $bar->advance();

            if ($pause > 0 && ($i + 1) % $batch === 0 && $i + 1 < count($plan)) {
                sleep($pause);
            }
        }

        $bar->finish();
        $this->newLine();
        $this->info("Перерисовано: {$done}, ошибок: {$failed}");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function regenerate(int $id, MediaUploadService $uploads): void
    {
        $old = Media::query()->findOrFail($id);
        $owner = User::query()->find($old->uploaded_by);

        if (! $owner) {
            throw new \RuntimeException('нет пользователя, загрузившего картинку');
        }

        $path = DemoImageFactory::createJpeg(
            $this->labelFor($id),
            (int) ($old->width ?: 900),
            (int) ($old->height ?: 675),
        );

        try {
            $file = new UploadedFile($path, 'demo.jpg', 'image/jpeg', null, true);
            $new = $uploads->storeUploadedFile($owner, $file, $old->purpose);
        } finally {
            @unlink($path);
        }

        $new->forceFill(['metadata' => array_merge((array) $new->metadata, ['caption' => 'ttf', 'replaces' => $old->uuid])])->save();

        DB::transaction(function () use ($old, $new): void {
            foreach ($this->references() as [$table, $column]) {
                DB::table($table)->where($column, $old->id)->update([$column => $new->id]);
            }
        });

        // У связок media_id стоит cascadeOnDelete: пропусти мы колонку, удаление
        // старой строки унесло бы и объявление без фото. Поэтому перед
        // удалением — проверка, что ссылок не осталось ни одной.
        $left = $this->referencesTo($old->id);
        if ($left !== []) {
            throw new \RuntimeException('на старую картинку ещё ссылаются: '.implode(', ', $left));
        }

        // Файлы — после транзакции: если она откатится, старая картинка
        // должна остаться целой.
        $disk = Storage::disk($old->disk);
        $files = [$old->path];
        foreach ((array) $old->variants as $formats) {
            foreach ((array) $formats as $slot) {
                if (is_array($slot) && ! empty($slot['path'])) {
                    $files[] = $slot['path'];
                }
            }
        }
        $disk->delete($files);
        $old->delete();
    }

    /** @var list<array{0: string, 1: string}>|null */
    private ?array $references = null;

    /**
     * Список выше плюс все внешние ключи на media из каталога базы. Список
     * один не спасает: появится новая колонка со ссылкой — и проверка перед
     * удалением её не увидит. Ключи из каталога добавляют её сами.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function references(): array
    {
        if ($this->references !== null) {
            return $this->references;
        }

        $pairs = self::REFERENCES;

        if (DB::getDriverName() === 'pgsql') {
            $rows = DB::select(<<<'SQL'
                select kcu.table_name, kcu.column_name
                from information_schema.table_constraints tc
                join information_schema.key_column_usage kcu
                  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
                join information_schema.constraint_column_usage ccu
                  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
                where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'media' and tc.table_schema = current_schema()
                SQL);
            foreach ($rows as $row) {
                $pairs[] = [(string) $row->table_name, (string) $row->column_name];
            }
        }

        $unique = [];
        foreach ($pairs as [$table, $column]) {
            if (Schema::hasColumn($table, $column)) {
                $unique["{$table}.{$column}"] = [$table, $column];
            }
        }

        return $this->references = array_values($unique);
    }

    /** @return list<string> */
    private function referencesTo(int $id): array
    {
        $found = [];
        foreach ($this->references() as [$table, $column]) {
            if (DB::table($table)->where($column, $id)->exists()) {
                $found[] = "{$table}.{$column}";
            }
        }

        return $found;
    }

    /**
     * Подпись — из того, что картинка изображает: название объявления или
     * записи, имя человека, сообщества, канала. Так же её подписывали
     * демо-разделы при создании.
     */
    private function labelFor(int $id): string
    {
        $text = DB::table('listing_media')->join('listings', 'listings.id', '=', 'listing_media.listing_id')
            ->where('listing_media.media_id', $id)->value('listings.title')
            ?? DB::table('post_media')->join('posts', 'posts.id', '=', 'post_media.post_id')
                ->where('post_media.media_id', $id)->value(DB::raw("coalesce(nullif(posts.title, ''), left(posts.body, 80))"))
            ?? DB::table('channel_post_media')->join('channel_posts', 'channel_posts.id', '=', 'channel_post_media.channel_post_id')
                ->where('channel_post_media.media_id', $id)->value(DB::raw('left(channel_posts.text, 80)'))
            ?? DB::table('user_profiles')->where('avatar_media_id', $id)->orWhere('cover_media_id', $id)->value('display_name')
            ?? DB::table('communities')->where('avatar_media_id', $id)->orWhere('cover_media_id', $id)->value('name')
            ?? DB::table('channels')->where('avatar_media_id', $id)->orWhere('banner_media_id', $id)->value('name')
            ?? DB::table('banners')->where('image_media_id', $id)->value('title');

        if ($text === null && DB::table('message_attachments')->where('media_id', $id)->exists()) {
            $text = 'Вложение';
        }

        return trim((string) ($text ?? 'МоДелизМ'));
    }
}
