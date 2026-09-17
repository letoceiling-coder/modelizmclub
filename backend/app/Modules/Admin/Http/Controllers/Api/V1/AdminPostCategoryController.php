<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Support\AdminAccess;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Modules\Admin\Http\Requests\UpsertCategoryRequest;
use Modules\Admin\Services\AuditService;

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
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate((int) request()->integer('per_page', 50));

        $items->getCollection()->transform(fn (PostCategory $c) => $this->present($c));

        return response()->json(['data' => $items]);
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
        if (AdminAccess::isOwner(request()->user())) {
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
                abort(403, 'Цены размещения меняет только Владелец.');
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
        return $category instanceof PostCategory
            ? $this->present($category->fresh()->load('listingCategory:id,listing_price_cents,subscriber_listing_price_cents'))
            : $category;
    }

    /** @return array<string, mixed> */
    private function present(PostCategory $c): array
    {
        return array_merge($c->withoutRelations()->toArray(), [
            'listing_price_cents' => $c->listingCategory?->listing_price_cents,
            'subscriber_listing_price_cents' => $c->listingCategory?->subscriber_listing_price_cents,
        ]);
    }
}
