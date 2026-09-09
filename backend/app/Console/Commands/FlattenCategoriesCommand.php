<?php

namespace App\Console\Commands;

use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;

/**
 * Приводит оба дерева категорий к двум уровням и связывает их между собой.
 *
 * ПОЧЕМУ ДВА УРОВНЯ. Третий уровень существует, но почти пуст: по две записи
 * в каждом дереве — «Автопилоты» и «ил 6». Адресация страниц направлений
 * двухуровневая по построению (`/categories/{id}/{subId}`), выразить в ней
 * третий уровень нечем. Держать уровень ради двух записей дороже, чем
 * перевесить эти две.
 *
 * ЧТО ЛОМАЛОСЬ У «ил 6». `depth = 2`, `path = aviation/aviation-civil/il-6`,
 * а `parent_id` пуст, и узла `aviation-civil` в таблице нет вовсе. Дерево,
 * построенное по `parent_id`, показывало «ил 6» корневым направлением рядом
 * с «Авиацией»; дерево по `path` — веткой, которой не существует. Родителем
 * становится тот, кого обещает первый сегмент пути.
 *
 * ПРОВЕРКА С ДРУГОЙ СТОРОНЫ. Считать затронутые строки тем же условием, что
 * стоит в правке, бессмысленно: если условие сломано, сломаны обе половины
 * одинаково. Поэтому после записи команда проверяет результат независимым
 * запросом — «сколько строк глубже первого уровня» и «сколько строк, у
 * которых path не сходится с parent_id», — и ждёт нулей.
 *
 * ЗА ЧТО ПРОВЕРКА ОТВЕЧАЕТ, А ЗА ЧТО НЕТ. Первый боевой прогон 09.09 показал
 * 8 несошедшихся строк в направлениях и 2 в каталоге — и ни одной из тех,
 * которые команда писала. У всех десяти path не заполнен вовсе: так их
 * когда-то и завели. Условие `is distinct from` считает NULL расхождением,
 * и проверка валила выкатку за чужое.
 *
 * Поэтому сверка путей смотрит только на строки, у которых path есть, —
 * ровно те, которые команда пишет. Строки без пути и строки, где depth
 * спорит с parent_id, считаются отдельно и печатаются поимённо: это
 * расхождение настоящее, но не этой правки, и прятать его внутрь общего
 * числа значило бы обменять красную выкатку на молчание. Оно не валит
 * прогон — оно называется вслух.
 *
 * Идемпотентна: повторный запуск на приведённых данных ничего не меняет.
 */
class FlattenCategoriesCommand extends Command
{
    protected $signature = 'categories:flatten
        {--dry-run : только показать, что будет сделано}
        {--link : заодно проставить связь направлений с категориями объявлений по совпадению slug}';

    protected $description = 'Свести деревья категорий к двум уровням и связать направления с каталогом';

    /** @var list<array{class-string, string}> */
    private const TREES = [
        [PostCategory::class, 'post_categories'],
        [ListingCategory::class, 'listing_categories'],
    ];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        foreach (self::TREES as [$model, $table]) {
            $this->line("=== {$table}");
            $this->flatten($model, $table, $dry);
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
         * Дерево категорий лежит в кеше сутки, и правка данных сама по себе
         * приложению не видна: первый боевой прогон 09.09 привёл базу в
         * порядок, а API ещё сутки отдавал бы «ил 6» третьим уровнем. Правка
         * данных мимо админки обязана сбрасывать тот же кеш, что сбрасывает
         * админка, — иначе она наполовину не состоялась.
         */
        CatalogService::flushCache();
        $this->line('кеш справочников сброшен');

        return $this->verify();
    }

    /** Перевешивает всё глубже первого уровня на его корневое направление. */
    private function flatten(string $model, string $table, bool $dry): void
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, PostCategory|ListingCategory> $deep */
        $deep = $model::query()->where('depth', '>', 1)->orderBy('id')->get();

        if ($deep->isEmpty()) {
            $this->line('    глубже первого уровня — нет, править нечего');

            return;
        }

        foreach ($deep as $node) {
            $root = $this->rootFor($model, $node);

            if (! $root) {
                $this->error("    {$node->slug}: корень не найден ни по parent_id, ни по path — пропускаю");

                continue;
            }

            $was = $node->parent_id === null ? 'NULL' : (string) $node->parent_id;
            $this->line("    {$node->slug}: parent_id {$was} → {$root->id} ({$root->slug}), depth {$node->depth} → 1");
            $this->line("        path {$node->path} → {$root->slug}/{$node->slug}");

            if ($dry) {
                continue;
            }

            $node->forceFill([
                'parent_id' => $root->id,
                'depth' => 1,
                'path' => "{$root->slug}/{$node->slug}",
            ])->save();
        }
    }

    /**
     * Корневое направление узла: сначала по цепочке parent_id, а если она
     * оборвана — по первому сегменту path. У «ил 6» работает только второй
     * путь, ради него он и написан.
     */
    private function rootFor(string $model, PostCategory|ListingCategory $node): PostCategory|ListingCategory|null
    {
        $current = $node;
        $hops = 0;

        while ($current->parent_id !== null && $hops < 10) {
            $parent = $model::query()->find($current->parent_id);
            if (! $parent) {
                break;
            }
            if ((int) $parent->depth === 0) {
                return $parent;
            }
            $current = $parent;
            $hops++;
        }

        $first = explode('/', (string) $node->path)[0] ?? '';

        return $first === '' ? null : $model::query()->where('slug', $first)->where('depth', 0)->first();
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
     * Независимая проверка: не тем условием, которым правили, а по факту в
     * данных. Ждём нулей в обоих запросах — и отдельно называем то, что
     * команда не создавала и не чинит.
     */
    private function verify(): int
    {
        $bad = 0;

        foreach (self::TREES as [, $table]) {
            $deep = DB::table($table)->where('depth', '>', 1)->count();

            // Только строки с путём: их команда и пишет. Строки без пути
            // считаются ниже, отдельной строкой отчёта.
            $mismatched = DB::table("{$table} as c")
                ->leftJoin("{$table} as p", 'p.id', '=', 'c.parent_id')
                ->whereNotNull('c.path')
                ->whereRaw("c.path is distinct from (case when c.parent_id is null then c.slug else p.slug || '/' || c.slug end)")
                ->count();

            $this->line("проверка {$table}: глубже первого уровня — {$deep}, путь не сходится с parent_id — {$mismatched}");
            $bad += $deep + $mismatched;

            $this->reportInherited($table);
        }

        if ($bad > 0) {
            $this->error('Проверка не сошлась — данные приведены не полностью.');

            return self::FAILURE;
        }

        $this->info('Проверка сошлась: оба дерева двухуровневые, пути согласованы с parent_id.');

        return self::SUCCESS;
    }

    /**
     * Расхождения, которые команда не создавала: строки без path и строки,
     * где depth спорит с parent_id. Печатаются поимённо — по номеру и слугу
     * их видно в админке, а «8 строк» не видно нигде.
     */
    private function reportInherited(string $table): void
    {
        $rows = DB::table($table)
            ->select('id', 'slug', 'depth', 'parent_id', 'path')
            ->where(function ($q): void {
                $q->whereNull('path')
                    ->orWhereRaw('(parent_id is null and depth <> 0) or (parent_id is not null and depth <> 1)');
            })
            ->orderBy('id')
            ->get();

        if ($rows->isEmpty()) {
            return;
        }

        $this->warn("    досталось в наследство, этой правкой не лечится — строк: {$rows->count()}");

        foreach ($rows as $row) {
            $what = $row->path === null ? 'без path' : 'depth спорит с parent_id';
            $parent = $row->parent_id === null ? 'NULL' : (string) $row->parent_id;
            $this->warn("        #{$row->id} {$row->slug}: {$what} (depth {$row->depth}, parent_id {$parent})");
        }
    }
}
