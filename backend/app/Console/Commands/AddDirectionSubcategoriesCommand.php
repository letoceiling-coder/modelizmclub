<?php

namespace App\Console\Commands;

use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\CategoryTaxonomyService;

/**
 * Заводит подкатегории направлений, согласованные с заказчиком 12.09, — тем
 * же путём, что админка: строка в `post_categories`, затем зеркало в каталог
 * объявлений и в категории сообществ через `CategoryTaxonomyService`.
 *
 * ЧТО ЗЕРКАЛИТСЯ. Направление, у которого нет ни одного зеркала (Корабли,
 * Автомобили и мото, Фигурки…), синхронизируется целиком — вместе с уже
 * существующими подкатегориями: иначе новой ветке не к чему прицепиться в
 * каталоге. У направления, которое уже отражено (Авиация, Бронетехника,
 * Рыбалка), синхронизируются только новые узлы. Полная синхронизация такого
 * направления переписала бы существующие зеркала: «ил 6» в каталоге висит
 * под Авиацией, а в дереве направлений — под Планерами, и она бы его
 * перевесила. Это решение о смысле раздела, и принимать его заодно команда
 * не должна.
 *
 * ПЛАН ПЕРЕД ЗАПИСЬЮ. Печатается каждый узел и каждая запись в зеркала:
 * создание или обновление какой строки. Зеркало ищется по пути, а потом по
 * slug, поэтому совпадение slug с чужой строкой молча перевесило бы её в
 * новое место. Такое совпадение — конфликт: команда останавливается до
 * записи и в сухом прогоне, и в настоящем.
 *
 * ПРОВЕРКА С ДРУГОЙ СТОРОНЫ. После записи результат пересчитывается
 * отдельными запросами по факту в таблицах, а не тем кодом, что писал:
 * у каждого направления, кроме исключённых, есть подкатегории; каждый узел
 * плана стоит под своим родителем и отражён в каталоге с тем же путём и тем
 * же родителем, а в сообществах — с тем же путём; depth и path согласованы с
 * parent_id (`categories:normalize --check`).
 *
 * Идемпотентна: узел, который уже стоит под своим родителем, пропускается.
 */
class AddDirectionSubcategoriesCommand extends Command
{
    protected $signature = 'categories:add-subcategories
        {--dry-run : показать план и записи в зеркала, ничего не писать}';

    protected $description = 'Завести согласованные 12.09 подкатегории направлений с зеркалами в каталог и сообщества';

    /**
     * Направления, которые остаются без подкатегорий: у Kotello и АкваРобота
     * назначение не определено, «Каналы» — служебный раздел.
     */
    public const EXEMPT_ROOTS = ['kotello', 'akvarobot', 'channels'];

    /**
     * slug родителя => [название, slug] новых детей. Порядок важен: родитель
     * третьего уровня (`vehicles-rc`) заводится раньше своих детей.
     *
     * @var array<string, list<array{0: string, 1: string}>>
     */
    public const PLAN = [
        'aviation' => [
            ['Вторая мировая', 'aviation-wwii'],
            ['Реактивная авиация', 'aviation-jets'],
            ['Гражданская авиация', 'aviation-civil'],
            ['Радиоуправляемые самолёты', 'aviation-rc'],
        ],
        'armor' => [
            ['САУ', 'armor-spg'],
            ['Радиоуправляемые танки', 'armor-rc'],
        ],
        'armor-tanks' => [
            ['Вторая мировая', 'armor-tanks-wwii'],
            ['Современные', 'armor-tanks-modern'],
        ],
        'ships' => [
            ['Парусники', 'ships-sailing'],
            ['Радиоуправляемые катера', 'ships-rc-boats'],
        ],
        'vehicles' => [
            ['Гоночные', 'vehicles-racing'],
            ['Радиоуправляемые', 'vehicles-rc'],
        ],
        'vehicles-rc' => [
            ['Багги и трагги', 'vehicles-rc-buggy'],
            ['Шоссейные', 'vehicles-rc-onroad'],
            ['Краулеры', 'vehicles-rc-crawlers'],
        ],
        'figures' => [
            ['Варгейм', 'figures-wargame'],
            ['Меха и Gundam', 'figures-mecha'],
        ],
        'dioramas' => [
            ['Военные', 'dioramas-military'],
            ['Гражданские и городские', 'dioramas-civil'],
            ['Виньетки', 'dioramas-vignettes'],
        ],
        'workshop' => [
            ['Инструмент', 'workshop-tools'],
            ['Аэрографы и компрессоры', 'workshop-airbrush'],
            ['Краски и химия', 'workshop-paints'],
            ['3D-печать', 'workshop-3d-print'],
        ],
        'korabli-dlya-rybalki' => [
            ['Эхолоты', 'eholoty'],
        ],
        'roboty' => [
            ['Колёсные и гусеничные', 'roboty-mobile'],
            ['Манипуляторы', 'roboty-arms'],
            ['Конструкторы', 'roboty-kits'],
        ],
        'techniques' => [
            ['Аэрограф', 'techniques-airbrush'],
            ['Сборка и подгонка', 'techniques-assembly'],
            ['Фототравление и доработка', 'techniques-photoetch'],
        ],
        'events' => [
            ['Выставки', 'events-exhibitions'],
            ['Конкурсы', 'events-contests'],
            ['Встречи клубов', 'events-meetups'],
            ['Онлайн', 'events-online'],
        ],
        'reviews' => [
            ['Распаковки', 'reviews-unboxing'],
            ['Сравнения', 'reviews-comparisons'],
            ['Обзоры инструмента', 'reviews-tools'],
        ],
    ];

    /** @var array<string, class-string<Model>> */
    private const MIRRORS = [
        'каталог' => ListingCategory::class,
        'сообщества' => CommunityCategory::class,
    ];

    public function handle(CategoryTaxonomyService $taxonomy): int
    {
        $dryRun = (bool) $this->option('dry-run');

        [$nodes, $problems] = $this->plan();
        $fullSync = $this->unmirroredRoots($nodes);
        $writes = $this->predictMirrorWrites($nodes, $fullSync);

        $this->printPlan($nodes, $fullSync, $writes);

        foreach ($writes as $w) {
            foreach ($w['mirrors'] as $label => [$action, $existing]) {
                if ($action === 'conflict') {
                    $problems[] = "{$label}: «{$w['path']}» займёт чужую строку id {$existing->id} с путём «{$existing->path}».";
                }
            }
        }

        if ($problems !== []) {
            foreach ($problems as $p) {
                $this->error($p);
            }
            $this->error('Ничего не записано.');

            return self::FAILURE;
        }

        $new = array_values(array_filter($nodes, fn (array $n): bool => $n['new']));

        if ($dryRun) {
            $this->info('Сухой прогон: новых узлов '.count($new).', в базу ничего не записано.');

            return self::SUCCESS;
        }

        if ($new === []) {
            $this->info('Все узлы плана уже на месте.');
        } else {
            $this->write($taxonomy, $new, $fullSync);
            $this->info('Заведено узлов: '.count($new).'.');
        }

        return $this->verify($nodes) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return array{0: list<array{parent: string, parent_path: string, name: string, slug: string, path: string, root: string, new: bool}>, 1: list<string>}
     */
    private function plan(): array
    {
        $nodes = [];
        $problems = [];
        /** @var array<string, string> $paths slug => путь, включая ещё не заведённые узлы */
        $paths = [];

        foreach (self::PLAN as $parentSlug => $children) {
            $parent = PostCategory::query()->where('slug', $parentSlug)->first();
            $parentPath = $paths[$parentSlug] ?? ($parent?->path ? (string) $parent->path : null);
            if ($parentPath === null || $parentPath === '') {
                $problems[] = "Родитель «{$parentSlug}» не найден.";

                continue;
            }
            $paths[$parentSlug] = $parentPath;

            foreach ($children as [$name, $slug]) {
                $existing = PostCategory::query()->where('slug', $slug)->first();
                if ($existing) {
                    if ($parent && (int) $existing->parent_id === (int) $parent->id) {
                        $paths[$slug] = (string) $existing->path;
                        $nodes[] = $this->node($parentSlug, $parentPath, $name, $slug, (string) $existing->path, false);

                        continue;
                    }
                    $problems[] = "slug «{$slug}» уже занят узлом id {$existing->id} с путём «{$existing->path}».";

                    continue;
                }

                $path = $parentPath.'/'.$slug;
                $paths[$slug] = $path;
                $nodes[] = $this->node($parentSlug, $parentPath, $name, $slug, $path, true);
            }
        }

        return [$nodes, $problems];
    }

    /** @return array{parent: string, parent_path: string, name: string, slug: string, path: string, root: string, new: bool} */
    private function node(string $parent, string $parentPath, string $name, string $slug, string $path, bool $new): array
    {
        return [
            'parent' => $parent,
            'parent_path' => $parentPath,
            'name' => $name,
            'slug' => $slug,
            'path' => $path,
            'root' => explode('/', $path)[0],
            'new' => $new,
        ];
    }

    /**
     * Корни, у которых нет ни одного зеркала: их синхронизация только
     * создаёт строки и потому может идти целиком.
     *
     * @param  list<array<string, mixed>>  $nodes
     * @return list<string>
     */
    private function unmirroredRoots(array $nodes): array
    {
        $roots = array_values(array_unique(array_map(
            fn (array $n): string => $n['root'],
            array_filter($nodes, fn (array $n): bool => $n['new']),
        )));

        return array_values(array_filter($roots, function (string $root): bool {
            foreach (self::MIRRORS as $class) {
                if ($class::query()->where('path', $root)->orWhere('slug', $root)->exists()) {
                    return false;
                }
            }

            return true;
        }));
    }

    /**
     * Что сделает синхронизация с каждым зеркалом — тот же поиск, что у
     * `CategoryTaxonomyService::mirror`: по пути, затем по slug. Только
     * чтение: писать будет сам сервис.
     *
     * @param  list<array<string, mixed>>  $nodes
     * @param  list<string>  $fullSync
     * @return list<array{path: string, new: bool, mirrors: array<string, array{0: string, 1: Model|null, 2: bool}>}>
     */
    private function predictMirrorWrites(array $nodes, array $fullSync): array
    {
        $targets = [];

        foreach ($fullSync as $root) {
            $existing = PostCategory::query()
                ->where('path', $root)
                ->orWhere('path', 'like', $root.'/%')
                ->orderBy('depth')
                ->orderBy('sort_order')
                ->get();
            foreach ($existing as $cat) {
                $parentPath = str_contains((string) $cat->path, '/')
                    ? substr((string) $cat->path, 0, (int) strrpos((string) $cat->path, '/'))
                    : null;
                $targets[] = ['path' => (string) $cat->path, 'slug' => (string) $cat->slug, 'parent_path' => $parentPath, 'new' => false];
            }
        }

        foreach ($nodes as $n) {
            if ($n['new']) {
                $targets[] = ['path' => $n['path'], 'slug' => $n['slug'], 'parent_path' => $n['parent_path'], 'new' => true];
            }
        }

        usort($targets, fn (array $a, array $b): int => substr_count($a['path'], '/') <=> substr_count($b['path'], '/'));

        $virtual = [];
        $writes = [];
        foreach ($targets as $t) {
            $mirrors = [];
            foreach (self::MIRRORS as $label => $class) {
                $mirrors[$label] = $this->predict($class, $t, $virtual);
            }
            $writes[] = ['path' => $t['path'], 'new' => $t['new'], 'mirrors' => $mirrors];
        }

        return $writes;
    }

    /**
     * @param  class-string<Model>  $class
     * @param  array{path: string, slug: string, parent_path: string|null}  $t
     * @param  array<string, array<string, true>>  $virtual  строки, которые создаст этот же прогон
     * @return array{0: string, 1: Model|null, 2: bool} действие, найденная строка, есть ли родитель
     */
    private function predict(string $class, array $t, array &$virtual): array
    {
        $parentSlug = $t['parent_path'] !== null ? basename($t['parent_path']) : null;
        $parentFound = $t['parent_path'] === null
            || isset($virtual[$class][$t['parent_path']])
            || $class::query()->where('path', $t['parent_path'])->exists()
            || $class::query()->where('slug', $parentSlug)->exists();

        $existing = $class::query()->where('path', $t['path'])->first()
            ?? $class::query()->where('slug', $t['slug'])->first();

        $virtual[$class][$t['path']] = true;

        if ($existing === null) {
            return ['create', null, $parentFound];
        }

        return [(string) $existing->path === $t['path'] ? 'same' : 'conflict', $existing, $parentFound];
    }

    /**
     * @param  list<array<string, mixed>>  $nodes
     * @param  list<string>  $fullSync
     * @param  list<array<string, mixed>>  $writes
     */
    private function printPlan(array $nodes, array $fullSync, array $writes): void
    {
        $this->line('Узлы плана:');
        $this->table(
            ['путь', 'название', 'узел'],
            array_map(fn (array $n): array => [$n['path'], $n['name'], $n['new'] ? 'новый' : 'на месте'], $nodes),
        );

        $this->line('Синхронизируются целиком (зеркал нет ни одного): '.($fullSync === [] ? '—' : implode(', ', $fullSync)));

        $describe = function (array $m): string {
            [$action, $existing, $parentFound] = $m;
            $text = match ($action) {
                'create' => 'создать',
                'same' => "есть, id {$existing->id}",
                default => "КОНФЛИКТ: id {$existing->id}, путь {$existing->path}",
            };

            return $parentFound ? $text : $text.' (корнем: родителя там нет)';
        };

        $this->line('Записи в зеркала:');
        $this->table(
            ['путь', 'узел', 'каталог', 'сообщества'],
            array_map(fn (array $w): array => [
                $w['path'],
                $w['new'] ? 'новый' : 'есть',
                $describe($w['mirrors']['каталог']),
                $describe($w['mirrors']['сообщества']),
            ], $writes),
        );
    }

    /**
     * @param  list<array<string, mixed>>  $new
     * @param  list<string>  $fullSync
     */
    private function write(CategoryTaxonomyService $taxonomy, array $new, array $fullSync): void
    {
        DB::transaction(function () use ($taxonomy, $new, $fullSync): void {
            /** @var array<string, PostCategory> $created */
            $created = [];

            foreach ($new as $n) {
                $parent = PostCategory::query()->where('slug', $n['parent'])->firstOrFail();
                $sort = (int) PostCategory::query()->where('parent_id', $parent->id)->max('sort_order') + 10;

                $category = new PostCategory;
                $category->forceFill([
                    'parent_id' => $parent->id,
                    'name' => $n['name'],
                    'slug' => $n['slug'],
                    'sort_order' => $sort,
                    'is_active' => true,
                    'depth' => (int) $parent->depth + 1,
                    'path' => $n['path'],
                ])->save();

                $created[$n['slug']] = $taxonomy->applyHierarchy($category);
            }

            // Корень без зеркал — целиком, вместе с уже заведёнными детьми.
            foreach ($fullSync as $root) {
                $taxonomy->syncFromPostCategory(PostCategory::query()->where('slug', $root)->firstOrFail());
            }

            // В отражённых направлениях — только новые узлы, родители раньше детей.
            foreach ($new as $n) {
                if (! in_array($n['root'], $fullSync, true)) {
                    $taxonomy->syncFromPostCategory($created[$n['slug']]->fresh());
                }
            }
        });

        CatalogService::flushCache();
    }

    /** @param  list<array<string, mixed>>  $nodes */
    private function verify(array $nodes): bool
    {
        $this->line('Проверка по факту в таблицах:');
        $failures = [];

        $bare = DB::table('post_categories as r')
            ->whereNull('r.parent_id')
            ->whereNotIn('r.slug', self::EXEMPT_ROOTS)
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('post_categories as c')->whereColumn('c.parent_id', 'r.id'))
            ->pluck('r.slug')
            ->all();
        foreach ($bare as $slug) {
            $failures[] = "направление «{$slug}» без подкатегорий";
        }

        foreach ($nodes as $n) {
            $row = DB::table('post_categories as c')
                ->join('post_categories as p', 'p.id', '=', 'c.parent_id')
                ->where('c.slug', $n['slug'])
                ->first(['c.path', 'p.slug as parent_slug']);
            if (! $row || $row->parent_slug !== $n['parent']) {
                $failures[] = "«{$n['slug']}» не стоит под «{$n['parent']}»";

                continue;
            }

            $listing = DB::table('listing_categories')->where('path', $row->path)->first(['id', 'parent_id']);
            if (! $listing) {
                $failures[] = "«{$row->path}»: нет зеркала в каталоге";
            } else {
                $expectedParent = substr((string) $row->path, 0, (int) strrpos((string) $row->path, '/'));
                $actualParent = DB::table('listing_categories')->where('id', $listing->parent_id)->value('path');
                if ($actualParent !== $expectedParent) {
                    $failures[] = "«{$row->path}»: в каталоге под «".($actualParent ?? 'корнем').'»';
                }
            }

            if (! DB::table('community_categories')->where('path', $row->path)->exists()) {
                $failures[] = "«{$row->path}»: нет зеркала в сообществах";
            }
        }

        foreach ($failures as $f) {
            $this->error('  '.$f);
        }
        if ($failures === []) {
            $this->info('  у направлений есть подкатегории, узлы плана на месте и отражены');
        }

        $treeOk = $this->call('categories:normalize', ['--check' => true]) === self::SUCCESS;

        return $failures === [] && $treeOk;
    }
}
