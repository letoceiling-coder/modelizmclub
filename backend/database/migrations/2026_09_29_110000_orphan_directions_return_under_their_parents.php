<?php

use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CatalogService;
use Modules\Catalog\Services\CategoryTaxonomyService;

/**
 * Осиротевшие направления возвращаются под своих родителей.
 *
 * ЧТО БЫЛО. В дереве направлений 42 узла с `parent_id = null`, но с
 * `depth > 0` и путём вида `figures/figures-busts`. Родителей —
 * `figures`, `techniques`, `workshop`, `by-scale` и ещё семи — в
 * `post_categories` нет вовсе. Дерево строится по `parent_id`, поэтому
 * все сорок два выводились как направления верхнего уровня: в каталоге
 * 52 корня вместо десяти, и «Бюсты», «Покраска», «Виньетки» стояли
 * рядом с «Авиацией».
 *
 * Пока порядок был по номерам, это кое-как маскировалось группировкой.
 * Алфавит 28.09 перемешал всё, и беспорядок стал виден с первого экрана.
 * Сверка `category-tree-drift.sh` ругалась на это и раньше — её просто
 * никто не запускал.
 *
 * ОТКУДА БЕРЁТСЯ СТРУКТУРА. Не из головы. Дерево направлений —
 * единственный источник, а деревья объявлений и сообществ строятся из
 * него зеркалами. Родители пропали только в источнике: в
 * `community_categories` живы все одиннадцать с русскими названиями
 * («Фигурки», «Техники и мастер-классы», «По масштабу»…), в
 * `listing_categories` — восемь. То есть структура записана, потерян
 * только её корень. Восстанавливаем по зеркалу, а не придумываем.
 *
 * Связь «ребёнок → родитель» тоже не гадание: первый сегмент `path`
 * узла и есть слуг его родителя. `path` пережил потерю родителя именно
 * потому, что его никто не пересчитывал.
 *
 * ЧТО ДЕЛАЕТ МИГРАЦИЯ
 *
 *   1. Для каждого осиротевшего узла берёт первый сегмент `path`.
 *   2. Если направления с таким слугом нет — заводит его, взяв название
 *      и значок из зеркала сообществ, иначе из зеркала объявлений.
 *   3. Привязывает детей и пересчитывает `depth` и `path` по `parent_id`.
 *   4. Гонит зеркала: `mirror()` находит существующие строки по слугу,
 *      так что дублей в каталоге и сообществах не появится.
 *
 * ФЛАГИ РОДИТЕЛЯ — объединение флагов его детей, а `is_active` — истина,
 * если активен хоть один ребёнок. Иначе восстановленный родитель мог бы
 * оказаться невидимым в ленте, и дети вместе с ним пропали бы из
 * каталога совсем — вместо беспорядка получилась бы пропажа.
 *
 * ОТКАТ отвязывает детей обратно в корень и убирает заведённых
 * родителей — но только тех, у кого не осталось ни детей, ни записей.
 * Восстановленный родитель, которым успели воспользоваться, не удаляется.
 */
return new class extends Migration
{
    public function up(): void
    {
        $сироты = PostCategory::query()
            ->whereNull('parent_id')
            ->where('depth', '>', 0)
            ->whereNotNull('path')
            ->get();

        if ($сироты->isEmpty()) {
            echo "  направления: сирот нет\n";

            return;
        }

        $поРодителю = $сироты->groupBy(fn (PostCategory $c) => explode('/', (string) $c->path)[0]);
        $заведено = 0;
        $привязано = 0;
        $необъяснимые = [];

        foreach ($поРодителю as $слуг => $дети) {
            if ($слуг === '' || $дети->contains(fn (PostCategory $c) => $c->slug === $слуг)) {
                // Путь начинается с самого узла — он и есть корень, всё в порядке.
                continue;
            }

            $родитель = PostCategory::query()->where('slug', $слуг)->first();

            if (! $родитель) {
                $образец = CommunityCategory::query()->where('slug', $слуг)->first()
                    ?? ListingCategory::query()->where('slug', $слуг)->first();

                if (! $образец) {
                    // Ни в одном зеркале — придумывать название нечем.
                    $необъяснимые[] = $слуг.' ('.$дети->count().')';

                    continue;
                }

                $родитель = PostCategory::query()->create([
                    'parent_id' => null,
                    'name' => $образец->name,
                    'slug' => $слуг,
                    'icon' => $образец->icon,
                    'sort_order' => (int) ($образец->sort_order ?? 0),
                    'is_active' => $дети->contains(fn (PostCategory $c) => (bool) $c->is_active),
                    'in_feed' => $дети->contains(fn (PostCategory $c) => (bool) $c->in_feed),
                    'in_listings' => $дети->contains(fn (PostCategory $c) => (bool) $c->in_listings),
                    'in_communities' => $дети->contains(fn (PostCategory $c) => (bool) $c->in_communities),
                    'depth' => 0,
                    'path' => $слуг,
                ]);
                $заведено++;
                echo "  направления: восстановлен родитель «{$родитель->name}» ({$слуг})\n";
            }

            foreach ($дети as $ребёнок) {
                PostCategory::query()->whereKey($ребёнок->id)->update(['parent_id' => $родитель->id]);
                $привязано++;
            }
        }

        foreach ($необъяснимые as $строка) {
            echo "  направления: НЕ ВОССТАНОВЛЕН — родителя {$строка} нет ни в одном зеркале\n";
        }

        $this->пересчитать();

        /*
         * Проверка с другой стороны, а не тем же условием: считаем сирот
         * заново прямым запросом. Если бы условие отбора было сломано,
         * сломаны были бы обе половины одинаково.
         */
        $осталось = DB::table('post_categories')->whereNull('parent_id')->where('depth', '>', 0)->count();

        echo "  направления: заведено родителей — {$заведено}, привязано узлов — {$привязано}, сирот осталось — {$осталось}\n";
    }

    public function down(): void
    {
        /*
         * Возврат: дети — обратно в корень, заведённые родители — прочь,
         * но только пустые. Родитель, под которым за это время что-то
         * появилось, остаётся: удалить его значило бы осиротить уже
         * чужую работу.
         */
        $слуги = ['figures', 'techniques', 'dioramas', 'workshop', 'by-scale', 'by-theme', 'regional', 'events', 'reviews', 'kits', 'ralli'];
        $родители = PostCategory::query()->whereIn('slug', $слуги)->get();

        foreach ($родители as $родитель) {
            PostCategory::query()->where('parent_id', $родитель->id)->update(['parent_id' => null]);
        }

        $this->пересчитать();

        $убрано = 0;
        foreach ($родители as $родитель) {
            $свежий = PostCategory::query()->find($родитель->id);
            if ($свежий && $свежий->children()->count() === 0 && $свежий->posts()->count() === 0) {
                $свежий->delete();
                $убрано++;
            }
        }

        echo "  направления: откат — родителей убрано {$убрано}\n";
    }

    /** Пересчёт `depth` и `path` по `parent_id` и прогон зеркал. */
    private function пересчитать(): void
    {
        $service = app(CategoryTaxonomyService::class);

        // Сверху вниз: у ребёнка глубина считается от уже пересчитанного
        // родителя, поэтому порядок обхода — по возрастанию глубины.
        foreach (PostCategory::query()->whereNull('parent_id')->orderBy('id')->get() as $корень) {
            $service->syncFromPostCategory($корень->fresh());
        }

        CatalogService::flushCache();
    }
};
