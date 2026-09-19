<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\Listing;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Catalog\Services\CategoryTaxonomyService;

/**
 * Чем ограничен сотрудник в модерации: всей площадкой или своими
 * направлениями (решение 19.09).
 *
 * Модератор и Владелец не ограничены — `for()` отдаёт null. Администратор
 * направления видит записи и объявления только из назначенных ему
 * направлений вместе с подкатегориями: в списках их нет, по прямой ссылке —
 * «не найдено», как если бы объекта не существовало. Остальные типы
 * модерации (сообщества, каналы, видео, заявки, жалобы) ему не видны вовсе.
 *
 * Объявления живут в своём дереве категорий; направлению соответствуют его
 * зеркала (CategoryTaxonomyService::listingIdsForPostCategory).
 */
final class CategoryScope
{
    /**
     * @param  list<int>  $postCategoryIds
     * @param  list<int>  $listingCategoryIds
     */
    private function __construct(
        public readonly array $postCategoryIds,
        public readonly array $listingCategoryIds,
    ) {}

    /** null — без ограничений. */
    public static function for(User $user): ?self
    {
        if ($user->isModerator()) {
            return null;
        }

        if ($user->role !== UserRole::CategoryAdmin) {
            return new self([], []);
        }

        $taxonomy = app(CategoryTaxonomyService::class);
        $postIds = [];
        $listingIds = [];
        foreach (self::assignedCategoryIds($user) as $rootId) {
            array_push($postIds, ...$taxonomy->descendantPostIds($rootId));
            array_push($listingIds, ...$taxonomy->listingIdsForPostCategory($rootId));
        }

        return new self(array_values(array_unique($postIds)), array_values(array_unique($listingIds)));
    }

    /** @return list<int> направления, назначенные человеку напрямую */
    public static function assignedCategoryIds(User $user): array
    {
        return DB::table('category_admins')
            ->where('user_id', $user->id)
            ->orderBy('post_category_id')
            ->pluck('post_category_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** @param  Builder<Post>  $query */
    public function constrainPosts(Builder $query): Builder
    {
        return $query->whereIn('category_id', $this->postCategoryIds === [] ? [0] : $this->postCategoryIds);
    }

    /** @param  Builder<Listing>  $query */
    public function constrainListings(Builder $query): Builder
    {
        $ids = $this->listingCategoryIds === [] ? [0] : $this->listingCategoryIds;

        return $query->where(function (Builder $q) use ($ids): void {
            $q->whereIn('category_id', $ids)->orWhereIn('subcategory_id', $ids);
        });
    }

    public function allowsPost(Post $post): bool
    {
        return in_array((int) $post->category_id, $this->postCategoryIds, true);
    }

    public function allowsListing(Listing $listing): bool
    {
        return in_array((int) $listing->category_id, $this->listingCategoryIds, true)
            || in_array((int) $listing->subcategory_id, $this->listingCategoryIds, true);
    }

    /** Модель из очереди модерации — записи и объявления, остальное закрыто. */
    public function allowsModeratable(mixed $model): bool
    {
        return match (true) {
            $model instanceof Post => $this->allowsPost($model),
            $model instanceof Listing => $this->allowsListing($model),
            default => false,
        };
    }
}
