<?php

namespace App\Console\Commands;

use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;

/**
 * Приводит `depth` и `path` в согласие с `parent_id` — на любой глубине.
 *
 * ЧЕМ ЭТО БЫЛО РАНЬШЕ. До 10.09 команда звалась `categories:flatten` и
 * сводила оба дерева к двум уровням: всё глубже первого перевешивалось в
 * корень. Обоснование было записано так: «адресация страниц направлений
 * двухуровневая по построению (`/categories/{id}/{subId}`), выразить в ней
 * третий уровень нечем».
 *
 * ЭТА ПРИЧИНА ИСТЕКЛА. Адрес направления стал односегментным —
 * `/categories/{slug}`, — а двухсегментный маршрут только переадресует.
 * Односегментный адрес выражает любую глубину: узел опознаётся слугом, а не
 * длиной пути. Держать дерево плоским больше не за чем, и «Планеры → ИЛ-6»
 * снова законная ветка.
 *
 * Записано это здесь нарочно: старое обоснование звучало убедительно, и
 * следующий, кто откроет файл, должен увидеть, что оно отменено, а не
 * восстанавливать по нему плоское дерево.
 *
 * ЧТО КОМАНДА ДЕЛАЕТ ТЕПЕРЬ. Единственный источник истины — `parent_id`.
 * `depth` считается длиной цепочки родителей, `path` — слугами этой цепочки
 * через косую черту. Ничего не перевешивается само: если `parent_id` пуст,
 * узел корневой, и это его право.
 *
 * ПЕРЕВЕС — ТОЛЬКО ЯВНЫЙ. `--move=<slug>:<parent-slug>` переносит узел под
 * названного родителя, `--move=<slug>:-` поднимает в корень. Пары
 * перечисляются руками и печатаются перед записью: перевес — это решение о
 * смысле раздела, и делать его по догадке команда не должна.
 *
 * ПРОВЕРКА С ДРУГОЙ СТОРОНЫ. Считать затронутые строки тем же условием, что
 * стоит в правке, бессмысленно: если условие сломано, сломаны обе половины
 * одинаково. Поэтому после записи результат пересчитывается независимым
 * запросом — по факту в данных — и ждёт нулей.
 *
 * Идемпотентна: повторный запуск на приведённых данных ничего не меняет.
 */
class NormalizeCategoriesCommand extends Command
{
    protected $signature = 'categories:normalize
        {--check : только проверить согласованность и выйти; ничего не писать}
        {--dry-run : только показать, что будет сделано}
        {--move=* : перевес узла: <slug>:<parent-slug>, либо <slug>:- в корень}
        {--link : заодно проставить связь направлений с категориями объявлений по совпадению slug}';

    protected $description = 'Привести depth и path в согласие с parent_id на любой глубине';

    /** Защита от кольца в parent_id: цепочка длиннее — это не дерево. */
    private const MAX_DEPTH = 10;

    /** @var list<array{class-string, string}> */
    private const TREES = [
        [PostCategory::class, 'post_categories'],
        [ListingCategory::class, 'listing_categories'],
    ];

    public function handle(): int
    {
        /*
         * `--check` нужен сверкам: `smoke-check.sh` зовёт команду после
         * каждой выкатки и ждёт нуля. Проверка та же самая, что после
         * записи, — второй реализации быть не должно, иначе они разойдутся
         * и правой рукой мы будем чинить то, что левая считает целым.
         */
        if ($this->option('check')) {
            return $this->verify();
        }

        $dry = (bool) $this->option('dry-run');

        /** @var list<string> $moves */
        $moves = (array) $this->option('move');

        if ($moves !== []) {
            $this->line('=== перевесы');
            if (! $this->applyMoves($moves, $dry)) {
                return self::FAILURE;
            }
        }

        foreach (self::TREES as [$model, $table]) {
            $this->line("=== {$table}");
            $this->normalize($model, $table, $dry);
        }

        if ($this->option('link')) {
            $this->line('=== связь направлений с каталогом');
            $this->link($dry);
        }

        if ($dry) {
            $this->warn('Это был холостой прогон — ничего не записано.');

            return self::SUCCESS;
        }

        /*
         * Дерево категорий лежит в кеше, и правка данных сама по себе
         * приложению не видна: 09.09 первый боевой прогон привёл базу в
         * порядок, а API ещё сутки отдавал бы прежнее дерево. Правка мимо
         * админки обязана сбрасывать тот же кеш, что сбрасывает админка.
         */
        CatalogService::flushCache();
        $this->line('кеш справочников сброшен');

        return $this->verify();
    }

    /**
     * Явные перевесы. Родитель ищется по слугу в том же дереве, что и узел.
     *
     * @param  list<string>  $moves
     */
    private function applyMoves(array $moves, bool $dry): bool
    {
        foreach ($moves as $pair) {
            $parts = explode(':', (string) $pair, 2);

            if (count($parts) !== 2 || trim($parts[0]) === '' || trim($parts[1]) === '') {
                $this->error("    не разобрал --move={$pair}: нужно <slug>:<parent-slug> или <slug>:-");

                return false;
            }

            [$slug, $parentSlug] = [trim($parts[0]), trim($parts[1])];
            $node = $this->findInAnyTree($slug);

            if (! $node) {
                $this->error("    узел {$slug} не найден ни в одном дереве");

                return false;
            }

            $model = $node::class;

            if ($parentSlug === '-') {
                $this->line("    {$slug}: parent_id → NULL (в корень)");
                if (! $dry) {
                    $node->forceFill(['parent_id' => null])->save();
                }

                continue;
            }

            /** @var Model|null $parent */
            $parent = $model::query()->where('slug', $parentSlug)->first();

            if (! $parent) {
                $this->error("    родитель {$parentSlug} не найден в том же дереве, что и {$slug}");

                return false;
            }

            if ((int) $parent->getKey() === (int) $node->getKey()) {
                $this->error("    {$slug}: сам себе родителем быть не может");

                return false;
            }

            $was = $node->parent_id === null ? 'NULL' : (string) $node->parent_id;
            $this->line("    {$slug}: parent_id {$was} → {$parent->getKey()} ({$parentSlug})");

            if (! $dry) {
                $node->forceFill(['parent_id' => $parent->getKey()])->save();
            }
        }

        return true;
    }

    private function findInAnyTree(string $slug): ?Model
    {
        foreach (self::TREES as [$model, ]) {
            /** @var Model|null $found */
            $found = $model::query()->where('slug', $slug)->first();

            if ($found) {
                return $found;
            }
        }

        return null;
    }

    /** Пересчитывает depth и path по цепочке parent_id. */
    private function normalize(string $model, string $table, bool $dry): void
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, Model> $all */
        $all = $model::query()->orderBy('id')->get();
        $byId = $all->keyBy(fn (Model $m) => (int) $m->getKey());
        $changed = 0;

        foreach ($all as $node) {
            $chain = $this->chainFor($node, $byId);

            if ($chain === null) {
                $this->error("    {$node->slug}: цепочка родителей длиннее {$this->maxDepth()} — похоже на кольцо, пропускаю");

                continue;
            }

            $depth = count($chain) - 1;
            $path = implode('/', array_map(static fn (Model $m): string => (string) $m->slug, $chain));

            if ((int) $node->depth === $depth && (string) $node->path === $path) {
                continue;
            }

            $changed++;
            $this->line("    {$node->slug}: depth {$node->depth} → {$depth}, path ".($node->path ?? 'ПУСТО')." → {$path}");

            if (! $dry) {
                $node->forceFill(['depth' => $depth, 'path' => $path])->save();
            }
        }

        if ($changed === 0) {
            $this->line('    всё уже сходится с parent_id');
        }
    }

    private function maxDepth(): int
    {
        return self::MAX_DEPTH;
    }

    /**
     * Цепочка от корня до узла включительно. null — если она длиннее
     * разумного: это кольцо, и трогать такой узел нельзя.
     *
     * @param  \Illuminate\Support\Collection<int, Model>  $byId
     * @return list<Model>|null
     */
    private function chainFor(Model $node, $byId): ?array
    {
        $chain = [$node];
        $current = $node;

        for ($hop = 0; $hop < self::MAX_DEPTH; $hop++) {
            $parentId = $current->getAttribute('parent_id');

            if ($parentId === null) {
                return array_reverse($chain);
            }

            $parent = $byId->get((int) $parentId);

            if (! $parent) {
                // Родитель назван, но его нет: считаем узел корневым, иначе
                // путь построить не из чего. Проверка ниже это назовёт.
                return array_reverse($chain);
            }

            $chain[] = $parent;
            $current = $parent;
        }

        return null;
    }

    /** Проставляет ссылку на категорию объявлений там, где совпал slug. */
    private function link(bool $dry): void
    {
        $listing = ListingCategory::query()->pluck('id', 'slug');
        $linked = 0;

        foreach (PostCategory::query()->orderBy('id')->get() as $direction) {
            $target = $listing[$direction->slug] ?? null;

            if ($target === null || (int) $direction->listing_category_id === (int) $target) {
                continue;
            }

            $this->line("    {$direction->slug} → категория объявлений #{$target}");
            $linked++;

            if (! $dry) {
                $direction->forceFill(['listing_category_id' => $target])->save();
            }
        }

        $this->line("    связей проставлено: {$linked}");
    }

    /**
     * Независимая проверка: не тем условием, которым правили, а по факту.
     *
     * Считаются три вещи, и все три должны быть нулём: строки, где `depth`
     * не равен длине цепочки; строки, где `path` не равен слугам цепочки;
     * строки, чей `parent_id` указывает в пустоту.
     */
    private function verify(): int
    {
        $bad = 0;

        foreach (self::TREES as [$model, $table]) {
            /** @var \Illuminate\Database\Eloquent\Collection<int, Model> $all */
            $all = $model::query()->orderBy('id')->get();
            $byId = $all->keyBy(fn (Model $m) => (int) $m->getKey());
            $depthOff = 0;
            $pathOff = 0;
            $orphans = 0;

            foreach ($all as $node) {
                $parentId = $node->getAttribute('parent_id');

                if ($parentId !== null && ! $byId->has((int) $parentId)) {
                    $orphans++;
                    $this->warn("    #{$node->getKey()} {$node->slug}: parent_id {$parentId} указывает в пустоту");
                }

                $chain = $this->chainFor($node, $byId);

                if ($chain === null) {
                    $bad++;

                    continue;
                }

                if ((int) $node->depth !== count($chain) - 1) {
                    $depthOff++;
                    $this->warn("    #{$node->getKey()} {$node->slug}: depth {$node->depth}, а цепочка ".(count($chain) - 1));
                }

                $path = implode('/', array_map(static fn (Model $m): string => (string) $m->slug, $chain));

                if ((string) $node->path !== $path) {
                    $pathOff++;
                    $this->warn("    #{$node->getKey()} {$node->slug}: path ".($node->path ?? 'ПУСТО')." против {$path}");
                }
            }

            $levels = $all->isEmpty() ? 0 : ((int) DB::table($table)->max('depth') + 1);
            $this->line("{$table}: строк {$all->count()}, уровней {$levels}, depth не сходится {$depthOff}, path не сходится {$pathOff}, сирот {$orphans}");
            $bad += $depthOff + $pathOff + $orphans;
        }

        if ($bad > 0) {
            $this->error("Проверка не сошлась: {$bad} расхождени(е/я). Разберитесь до следующего запуска.");

            return self::FAILURE;
        }

        $this->info('Проверка сошлась: depth и path согласованы с parent_id в обоих деревьях.');

        return self::SUCCESS;
    }
}
