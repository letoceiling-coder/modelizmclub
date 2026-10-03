<?php

namespace Modules\Media\Services;

use App\Models\Media;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Удаление медиа целиком: объект в хранилище, все его производные и строка.
 *
 * До 03.10 такого места не было, и «удалить» означало разное в разных углах:
 * `UserFullDeletionService` убирал строку `media` и оставлял объект в бакете,
 * удаление сообщения «у всех» не трогало ни строку, ни объект, а единственный
 * код, который реально подчищал хранилище, жил в нагрузочном стенде
 * (`StressTestCommand`) и про производные копии не знал.
 *
 * Производные важны не меньше оригинала: `MediaVariantProcessor` раскладывает
 * их по `media.variants` как `[слот][формат]['path']`, и для картинки их до
 * двенадцати, а для видео туда же попадают постер и облегчённая копия. Имена
 * слотов здесь намеренно не перечислены — обход идёт по самому `variants`,
 * чтобы новый слот не пришлось дописывать во второе место.
 *
 * Отказ хранилища не отменяет удаления строки. Иначе один сбой S3 оставлял бы
 * человека с неудалённой перепиской, а повторить операцию было бы нечем:
 * строка-то на месте, а что к ней прилагалось — уже не узнать. Поэтому
 * промах пишется в журнал с причиной и путём: по этой записи объект можно
 * убрать руками, а молчаливый `catch` такой возможности не оставляет.
 */
class MediaDeletionService
{
    /**
     * Стереть объекты и строки.
     *
     * @param  iterable<Media>  $items
     * @return int сколько строк удалено
     */
    public function erase(iterable $items): int
    {
        $удалено = 0;

        foreach ($items as $media) {
            $this->eraseObjects($media);
            $media->delete();
            $удалено++;
        }

        return $удалено;
    }

    /**
     * Стереть только файлы, строку оставить.
     *
     * Нужно там, где строки убираются пачкой одним запросом, а объекты всё
     * равно надо перечислить поимённо.
     */
    public function eraseObjects(Media $media): void
    {
        $disk = Storage::disk($media->disk);

        foreach ($this->paths($media) as $path) {
            try {
                $disk->delete($path);
            } catch (Throwable $e) {
                Log::warning('Не удалось удалить объект медиа из хранилища', [
                    'media_uuid' => $media->uuid,
                    'disk' => $media->disk,
                    'path' => $path,
                    'reason' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Оригинал и все производные.
     *
     * @return list<string>
     */
    private function paths(Media $media): array
    {
        $paths = [];

        if (is_string($media->path) && $media->path !== '') {
            $paths[] = $media->path;
        }

        foreach ((array) ($media->variants ?? []) as $форматы) {
            foreach ((array) $форматы as $вариант) {
                $path = is_array($вариант) ? ($вариант['path'] ?? null) : null;

                if (is_string($path) && $path !== '') {
                    $paths[] = $path;
                }
            }
        }

        return array_values(array_unique($paths));
    }
}
