<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\CommunityCategory;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Support\AdminAccess;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Http\Requests\UpsertCategoryRequest;
use Modules\Admin\Services\AuditService;
use Modules\Catalog\Services\CatalogService;

/**
 * Дерево направлений — единственное место, где правятся категории.
 *
 * Деревья объявлений и сообществ строятся из него (CategoryTaxonomyService::
 * mirror); где узел виден, решают флаги in_feed / in_listings /
 * in_communities. Цена размещения живёт в узле дерева объявлений, но
 * правится здесь же, в строке направления.
 */
#[Group('Admin — Categories', weight: 40)]
class AdminPostCategoryController extends AdminCategoryController
{
    /**
     * Шаг нумерации порядка: 10, 20, 30…
     *
     * Тот же, что в наполнении справочника и в `sortOrderAt` на клиенте.
     */
    private const SORT_STEP = 10;

    protected function modelClass(): string
    {
        return PostCategory::class;
    }

    protected function auditPrefix(): string
    {
        return 'admin.categories.post';
    }

    public function index(): JsonResponse
    {
        $items = PostCategory::query()
            ->with('listingCategory:id,listing_price_cents,subscriber_listing_price_cents')
            /*
             * Счётчики в узле — чтобы решение о переносе или удалении
             * принималось с числом перед глазами, а не вслепую.
             *
             * `withCount` по одному запросу на связь, а не по запросу на
             * строку: направлений девяносто два, и без этого раскрытие
             * дерева стоило бы двух сотен обращений.
             *
             * Записи считаются по самому направлению, объявления — по его
             * полке в каталоге (`listing_category_id`), и полки может не
             * быть вовсе: у «Мастерской» и «Выставок» её нет и не
             * предполагается. Тогда объявлений ноль, а не «неизвестно».
             */
            ->withCount('posts')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate((int) request()->integer('per_page', 50));

        // Объявления считаются отдельно: связь идёт через полку каталога,
        // и лот может стоять как в категории, так и в подкатегории.
        $полки = $items->getCollection()
            ->pluck('listing_category_id')
            ->filter()
            ->unique()
            ->values();

        /*
         * Администраторы направлений — отдельным запросом, а не связью:
         * модели у `category_admins` нет, таблица читается напрямую и в
         * `CategoryScope`. Заводить модель ради счётчика значило бы
         * завести второй способ ходить в ту же таблицу.
         */
        $сАдмином = DB::table('category_admins')
            ->select('post_category_id')
            ->distinct()
            ->pluck('post_category_id')
            ->flip();

        $объявлений = $полки->isEmpty()
            ? collect()
            : Listing::query()
                ->whereIn(DB::raw('coalesce(subcategory_id, category_id)'), $полки)
                ->selectRaw('coalesce(subcategory_id, category_id) as полка, count(*) as сколько')
                ->groupBy('полка')
                ->pluck('сколько', 'полка');

        $items->getCollection()->transform(
            fn (PostCategory $c) => $this->present(
                $c,
                (int) ($объявлений[$c->listing_category_id] ?? 0),
                $сАдмином->has($c->id),
            ),
        );

        return response()->json(['data' => $items]);
    }

    /**
     * Порядок в одном ряду — одним запросом.
     *
     * Перестановка соседей не меняет дерева — меняется только `sort_order`.
     * Идти ради этого через обычный PUT по узлу было бы дорого и шумно:
     * каждый такой запрос тянет за собой `syncFromPostCategory` по всему
     * поддереву, сброс кеша каталога и отдельную строку аудита со снимками
     * «до/после». В ряду из десяти направлений это десять перестроек
     * поддерева и десять записей аудита там, где человек сделал одно
     * движение.
     *
     * Но номер проставляется и зеркалам. У `listing_categories` и
     * `communities_categories` свой `sort_order`, и публичные деревья
     * сортируются по нему (`CatalogService::categoryTree`). Запиши мы
     * только направление — админка и лента показали бы новый порядок, а
     * каталог объявлений, форма подачи и сообщества остались бы со
     * старым, и `flushCache` тут же закрепил бы его как свежий. Перестройки
     * поддерева это всё равно не требует: у зеркала меняется одно поле.
     *
     * Ряд присылается целиком и проверяется: это должны быть ровно все
     * дети одного родителя. Неполный ряд означал бы, что клиент видит не
     * всё дерево (страница списка обрезана), и перенумерация расставила бы
     * невидимым соседям чужие номера. Лучше отказать вслух.
     */
    public function reorder(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:2'],
            'ids.*' => ['integer', 'distinct', 'exists:post_categories,id'],
        ]);

        $ids = array_map('intval', $data['ids']);
        $ряд = PostCategory::query()->whereIn('id', $ids)->get();

        $родители = $ряд->pluck('parent_id')->unique();
        if ($родители->count() !== 1) {
            abort(422, 'Порядок меняется внутри одного ряда: у всех узлов должен быть один родитель.');
        }

        $родитель = $родители->first();
        $всеДети = PostCategory::query()
            ->when($родитель === null, fn ($q) => $q->whereNull('parent_id'))
            ->when($родитель !== null, fn ($q) => $q->where('parent_id', $родитель))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (array_diff($всеДети, $ids) !== [] || array_diff($ids, $всеДети) !== []) {
            abort(422, 'Ряд пришёл не целиком: порядок можно менять только зная всех соседей.');
        }

        $было = $ряд->sortBy('sort_order')->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        /*
         * Порядок обхода — по возрастанию id, а не по новому порядку ряда.
         * Две вкладки, переставляющие один ряд одновременно, иначе брали бы
         * блокировки строк в разном порядке, и Postgres снял бы одну из
         * транзакций взаимной блокировкой — человек получил бы 500 вместо
         * понятного ответа.
         */
        $номера = [];
        foreach ($ids as $позиция => $id) {
            $номера[$id] = ($позиция + 1) * self::SORT_STEP;
        }
        ksort($номера);

        DB::transaction(function () use ($номера, $ряд): void {
            foreach ($номера as $id => $номер) {
                PostCategory::query()->whereKey($id)->update(['sort_order' => $номер]);

                $узел = $ряд->firstWhere('id', $id);
                if ($узел?->listing_category_id) {
                    ListingCategory::query()->whereKey($узел->listing_category_id)->update(['sort_order' => $номер]);
                }
                if ($узел?->community_category_id) {
                    CommunityCategory::query()->whereKey($узел->community_category_id)->update(['sort_order' => $номер]);
                }
            }
        });

        $audit->log(
            $request->user(),
            $this->auditPrefix().'.reorder',
            null,
            ['ids' => $было],
            ['ids' => $ids, 'parent_id' => $родитель],
            $request,
        );
        CatalogService::flushCache();

        return response()->json(['data' => ['message' => 'Порядок сохранён.']]);
    }

    /**
     * Цены размещения — деньги, их меняет только Владелец. Модератор правит
     * дерево и флаги; админка отправляет цены строки как есть, поэтому
     * отказ — только если значение действительно меняется.
     *
     * @param  array<string, mixed>  $validated
     */
    private function guardOwnerOnlyFields(array $validated, ?PostCategory $current): void
    {
        // По ключу, а не по роли: право на цены выдаётся и отдельно (C3).
        if (AdminAccess::allows(request()->user(), 'categories.prices')) {
            return;
        }
        $mirror = $current?->listing_category_id ? ListingCategory::query()->find($current->listing_category_id) : null;
        foreach (AdminAccess::OWNER_ONLY_CATEGORY_FIELDS as $field) {
            if (! array_key_exists($field, $validated)) {
                continue;
            }
            $was = $mirror?->{$field};
            $now = $validated[$field];
            if ($now !== null && (int) $now !== (int) $was || $now === null && $was !== null) {
                abort(403, 'Цены размещения меняет Владелец или тот, кому это право выдано.');
            }
        }
    }

    public function store(UpsertCategoryRequest $request, AuditService $audit): JsonResponse
    {
        $this->guardOwnerOnlyFields($request->validated(), null);

        return parent::store($request, $audit);
    }

    public function update(UpsertCategoryRequest $request, int $id, AuditService $audit): JsonResponse
    {
        $this->guardOwnerOnlyFields($request->validated(), PostCategory::query()->find($id));

        return parent::update($request, $id, $audit);
    }

    /** @param  array<string, mixed>  $validated */
    protected function afterMutate(Model $category, ?string $previousPath = null, array $validated = []): void
    {
        parent::afterMutate($category, $previousPath, $validated);

        $category->refresh();
        $prices = array_intersect_key($validated, array_flip(['listing_price_cents', 'subscriber_listing_price_cents']));
        if ($prices !== [] && $category->listing_category_id) {
            ListingCategory::query()->whereKey($category->listing_category_id)->update($prices);
        }
    }

    /**
     * Узел — вместе с ценой размещения из каталога. Без неё админка после
     * любой правки названия получала пустые цены и следующим сохранением
     * затирала их в каталоге.
     */
    protected function presentForResponse(Model $category): mixed
    {
        if (! $category instanceof PostCategory) {
            return $category;
        }

        /*
         * Счётчики считаются и здесь, для одного узла. Иначе ответ на
         * сохранение приходил бы без них, админка подставляла бы его в
         * список вместо прежней строки — и числа пропадали бы с экрана
         * до перезагрузки страницы. Два лишних запроса на запись дешевле,
         * чем исчезающие числа.
         */
        $c = $category->fresh()
            ->load('listingCategory:id,listing_price_cents,subscriber_listing_price_cents')
            ->loadCount('posts');

        return $this->present($c, $this->listingsIn($c), $this->hasAdmin($c));
    }

    /**
     * Объявления направления — по его полке в каталоге.
     *
     * Условие то же, что в `index`: лот считается тому узлу, в котором
     * лежит, то есть подкатегории, если она указана. Разойдись эти два
     * места — число после сохранения отличалось бы от числа в списке.
     */
    private function listingsIn(PostCategory $c): int
    {
        if ($c->listing_category_id === null) {
            return 0;
        }

        return Listing::query()
            ->whereRaw('coalesce(subcategory_id, category_id) = ?', [$c->listing_category_id])
            ->count();
    }

    private function hasAdmin(PostCategory $c): bool
    {
        return DB::table('category_admins')->where('post_category_id', $c->id)->exists();
    }

    /**
     * Узел для ответа. Счётчики — обязательные аргументы, а не значения по
     * умолчанию: умолчание давало бы ноль там, где их просто забыли
     * посчитать, и отличить забытое от настоящего нуля было бы нельзя.
     *
     * @return array<string, mixed>
     */
    private function present(PostCategory $c, int $listingsCount, bool $hasAdmin): array
    {
        return array_merge($c->withoutRelations()->toArray(), [
            'listing_price_cents' => $c->listingCategory?->listing_price_cents,
            'subscriber_listing_price_cents' => $c->listingCategory?->subscriber_listing_price_cents,
            'posts_count' => (int) ($c->posts_count ?? 0),
            'listings_count' => $listingsCount,
            /* Не число, а ответ на вопрос «есть ли у направления хозяин». */
            'has_admin' => $hasAdmin,
        ]);
    }
}
