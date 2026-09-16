<?php

namespace Modules\Admin\Http\Controllers\Api\V1;

use App\Models\ListingCategory;
use App\Models\PostCategory;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;

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
