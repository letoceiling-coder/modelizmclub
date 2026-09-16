<?php

namespace App\Console\Commands;

use App\Models\Community;
use App\Models\CommunityApplication;
use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\CategoryTaxonomyService;

/**
 * Делает дерево направлений (post_categories) единственным источником.
 *
 * Разбор 17.09 на проде: 79 направлений, 86 категорий объявлений, 85 —
 * сообществ; по пути совпадают 76 и 60 узлов, связь `listing_category_id`
 * заполнена у 12. Команда:
 *
 *  1. связывает совпадающие по `path` узлы (listing_category_id,
 *     community_category_id);
 *  2. переносит в дерево направлений узлы, которые есть только в дереве
 *     объявлений (торговые разделы: «Наборы», «Литература»…), с флагом
 *     «только объявления»;
 *  3. переносит группировки, которые есть только у сообществ («По масштабу»,
 *     «Региональные клубы»…), с флагом «только сообщества». Брошенные узлы —
 *     корневые дубли направлений без единого сообщества и заявки («ил 6»,
 *     «Планеры» на верхнем уровне) — не переносит и не удаляет: из деревьев
 *     разделов они пропадают сами, потому что ни с чем не связаны;
 *  4. снимает флаг «Объявления» с разделов, где продавать нечего;
 *  5. заводит недостающие зеркала для видимых узлов («Kotello» в каталоге).
 *
 * Ничего не удаляет: объявления, цены размещения и промокоды ссылаются на
 * те же строки, что и раньше. По умолчанию — пробный прогон, запись только
 * с --apply. Повторный запуск на приведённых данных ничего не меняет.
 */
class CategoriesSingleSourceCommand extends Command
{
    protected $signature = 'categories:single-source {--apply : записать изменения (без флага — только показать)}';

    protected $description = 'Связать деревья категорий с деревом направлений и расставить флаги разделов';

    /** Разделы, где объявлений не бывает по смыслу: путь названий → флаги. */
    private const NOT_FOR_LISTINGS = [
        ['Каналы'],
        ['Выставки и события'],
        ['Обзоры наборов'],
        ['Техники и мастер-классы'],
        ['Рыбалка', 'Водоёмы'],
    ];

    /** Разделы, которым не нужна полка в сообществах. */
    private const NOT_FOR_COMMUNITIES = [
        ['Каналы'],
    ];

    private bool $apply = false;

    public function handle(CategoryTaxonomyService $taxonomy): int
    {
        $this->apply = (bool) $this->option('apply');
        $this->line($this->apply ? 'ЗАПИСЬ' : 'ПРОБНЫЙ ПРОГОН (для записи — --apply)');

        $run = function () use ($taxonomy): void {
            $this->linkByPath(ListingCategory::class, 'listing_category_id');
            $this->linkByPath(CommunityCategory::class, 'community_category_id');
            $this->importOnly(ListingCategory::class, 'listing_category_id', ['in_feed' => false, 'in_listings' => true, 'in_communities' => false]);
            $this->importOnly(CommunityCategory::class, 'community_category_id', ['in_feed' => false, 'in_listings' => false, 'in_communities' => true]);
            $this->clearFlag(self::NOT_FOR_LISTINGS, 'in_listings');
            $this->clearFlag(self::NOT_FOR_COMMUNITIES, 'in_communities');
            $this->createMissingMirrors($taxonomy);
        };

        if ($this->apply) {
            DB::transaction($run);
            CatalogService::flushCache();
        } else {
            DB::beginTransaction();
            try {
                $run();
            } finally {
                DB::rollBack();
            }
        }

        return $this->report($taxonomy);
    }

    /** @param  class-string<Model>  $class */
    private function linkByPath(string $class, string $linkColumn): void
    {
        $linked = PostCategory::query()->whereNotNull($linkColumn)->pluck($linkColumn)->map(fn ($id) => (int) $id)->all();
        $mirrors = $class::query()->whereNotIn('id', $linked ?: [0])->get()->keyBy('path');
        $rows = [];
        foreach (PostCategory::query()->whereNull($linkColumn)->orderBy('depth')->get() as $post) {
            $mirror = $mirrors->get($post->path);
            if (! $mirror) {
                continue;
            }
            if ($this->namePath(PostCategory::query()->get()->keyBy('id'), $post) !== $this->namePath($class::query()->get()->keyBy('id'), $mirror)) {
                $this->warn("  путь {$post->path} совпал, названия разные — не связываю: {$post->name} / {$mirror->name}");

                continue;
            }
            $post->forceFill([$linkColumn => $mirror->id])->saveQuietly();
            $mirrors->forget($post->path);
            $rows[] = $this->namePath(PostCategory::query()->get()->keyBy('id'), $post);
        }
        $this->info(sprintf('связь %s по пути: %d', $linkColumn, count($rows)));
    }

    /**
     * @param  class-string<Model>  $class
     * @param  array<string, bool>  $flags
     */
    private function importOnly(string $class, string $linkColumn, array $flags): void
    {
        $all = $class::query()->get()->keyBy('id');
        $imported = [];
        $skipped = [];

        foreach ($all->sortBy('depth') as $node) {
            if (PostCategory::query()->where($linkColumn, $node->id)->exists()) {
                continue;
            }
            $parentPost = $node->parent_id ? PostCategory::query()->where($linkColumn, $node->parent_id)->first() : null;
            if ($node->parent_id && ! $parentPost) {
                $skipped[] = $this->namePath($all, $node).' (родитель не перенесён)';

                continue;
            }
            if ($class === CommunityCategory::class && ! $node->parent_id && $this->isAbandonedCommunityRoot($node, $all)) {
                $skipped[] = $this->namePath($all, $node).' (брошенный дубль направления)';

                continue;
            }
            if (PostCategory::query()->where('slug', $node->slug)->exists()) {
                $skipped[] = $this->namePath($all, $node)." (slug «{$node->slug}» уже занят направлением)";

                continue;
            }

            $post = PostCategory::query()->create(array_merge([
                'parent_id' => $parentPost?->id,
                'name' => $node->name,
                'slug' => $node->slug,
                'icon' => $node->icon,
                'sort_order' => $node->sort_order,
                'is_active' => $node->is_active,
                $linkColumn => $node->id,
            ], $flags));
            app(CategoryTaxonomyService::class)->applyHierarchy($post);
            $imported[] = $this->namePath($all, $node);
        }

        $this->info(sprintf('перенесено из %s: %d', class_basename($class), count($imported)));
        foreach ($imported as $row) {
            $this->line("  + {$row}");
        }
        foreach ($skipped as $row) {
            $this->line("  − {$row}");
        }
    }

    /** Корневой узел сообществ, повторяющий название направления, без сообществ и заявок во всём поддереве. */
    private function isAbandonedCommunityRoot(CommunityCategory $root, Collection $all): bool
    {
        $namesake = PostCategory::query()->whereRaw('lower(name) = ?', [mb_strtolower($root->name)])->exists();
        if (! $namesake) {
            return false;
        }
        $ids = [$root->id];
        for ($i = 0; $i < count($ids); $i++) {
            foreach ($all->where('parent_id', $ids[$i]) as $child) {
                $ids[] = $child->id;
            }
        }

        return ! Community::query()->whereIn('category_id', $ids)->exists()
            && ! CommunityApplication::query()->whereIn('category_id', $ids)->exists();
    }

    /** @param  list<list<string>>  $paths */
    private function clearFlag(array $paths, string $flag): void
    {
        $posts = PostCategory::query()->get()->keyBy('id');
        foreach ($paths as $names) {
            $hit = $posts->first(fn (PostCategory $p) => $this->namePath($posts, $p) === implode(' / ', $names));
            if (! $hit) {
                $this->warn('  не найден раздел: '.implode(' / ', $names));

                continue;
            }
            if ($hit->{$flag}) {
                $hit->forceFill([$flag => false])->saveQuietly();
            }
            $this->line("  {$flag}=0: ".implode(' / ', $names));
        }
    }

    private function createMissingMirrors(CategoryTaxonomyService $taxonomy): void
    {
        $created = [];
        foreach (['in_listings' => ['listing_category_id', ListingCategory::class], 'in_communities' => ['community_category_id', CommunityCategory::class]] as $flag => [$link, $class]) {
            $visible = $taxonomy->visiblePostIds($flag);
            $missing = PostCategory::query()->whereIn('id', $visible)->whereNull($link)->orderBy('depth')->get();
            foreach ($missing as $post) {
                $created[] = class_basename($class).': '.$this->namePath(PostCategory::query()->get()->keyBy('id'), $post);
            }
        }
        foreach (PostCategory::query()->whereNull('parent_id')->orderBy('sort_order')->get() as $root) {
            $taxonomy->syncFromPostCategory($root);
        }
        $this->info('заведено зеркал для видимых узлов: '.count($created));
        foreach ($created as $row) {
            $this->line("  + {$row}");
        }
    }

    private function report(CategoryTaxonomyService $taxonomy): int
    {
        if (! $this->apply) {
            return self::SUCCESS;
        }
        // Проверка с другой стороны — по фактам в данных, а не тем же условием.
        $listingVisible = $taxonomy->visibleMirrorIds(ListingCategory::class);
        $orphanListings = Listing::query()
            ->whereNull('deleted_at')
            ->where(fn ($q) => $q->whereNotIn('category_id', $listingVisible ?: [0]))
            ->count();
        $unlinkedListingCats = ListingCategory::query()
            ->whereNotIn('id', PostCategory::query()->whereNotNull('listing_category_id')->pluck('listing_category_id'))
            ->count();
        $this->info("объявлений в категориях, скрытых из каталога: {$orphanListings}");
        $this->info("категорий объявлений без связи с направлением: {$unlinkedListingCats}");

        return self::SUCCESS;
    }

    private function namePath(Collection $byId, Model $node): string
    {
        $names = [];
        $cursor = $node;
        $guard = 0;
        while ($cursor && $guard++ < 16) {
            array_unshift($names, (string) $cursor->name);
            $cursor = $cursor->parent_id ? $byId->get($cursor->parent_id) : null;
        }

        return implode(' / ', $names);
    }
}
