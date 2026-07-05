<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingMedia;
use App\Models\Media;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ListingService
{
    /** @return list<string> */
    private function relations(): array
    {
        return ['author.profile.avatar', 'category', 'subcategory', 'city', 'mediaItems.media'];
    }

    /**
     * Публичный каталог опубликованных объявлений с расширенной фильтрацией.
     *
     * Поддерживаемые фильтры:
     *  - category_id, subcategory_id, city_id — точное совпадение
     *  - category_ids[] — несколько категорий сразу
     *  - q — поиск по названию/описанию
     *  - price_min / price_max — диапазон цены в рублях (переводится в копейки)
     *  - delivery_method — способ доставки (в JSON-массиве delivery_methods)
     *  - has_media — только с фото
     *  - sort — newest|oldest|price_asc|price_desc|popular
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters, int $perPage = 20): LengthAwarePaginator
    {
        $query = Listing::query()
            ->with($this->relations())
            ->where('status', ListingStatus::Published)
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when($filters['subcategory_id'] ?? null, fn ($q, $id) => $q->where('subcategory_id', $id))
            ->when($filters['city_id'] ?? null, fn ($q, $id) => $q->where('city_id', $id))
            ->when(! empty($filters['category_ids']), fn ($q) => $q->whereIn('category_id', (array) $filters['category_ids']))
            ->when($filters['q'] ?? null, fn ($q, $term) => $this->applyTextSearch($q, (string) $term))
            ->when(isset($filters['price_min']), fn ($q) => $q->where('price_cents', '>=', (int) round(((float) $filters['price_min']) * 100)))
            ->when(isset($filters['price_max']), fn ($q) => $q->where('price_cents', '<=', (int) round(((float) $filters['price_max']) * 100)))
            ->when($filters['delivery_method'] ?? null, fn ($q, $method) => $q->whereJsonContains('delivery_methods', $method))
            ->when(($filters['has_media'] ?? null) === true, fn ($q) => $q->whereHas('mediaItems'))
            ->when(($filters['has_media'] ?? null) === false, fn ($q) => $q->whereDoesntHave('mediaItems'));

        $this->applySort($query, $filters['sort'] ?? 'newest');

        return $query->paginate($perPage);
    }

    /**
     * Объявления текущего пользователя. Можно фильтровать по статусу и сортировать.
     *
     * @param  array<string, mixed>  $filters
     */
    public function myListings(User $user, array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Listing::query()
            ->with($this->relations())
            ->where('user_id', $user->id)
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, fn ($q, $term) => $this->applyTextSearch($q, (string) $term, titleOnly: true));

        $this->applySort($query, $filters['sort'] ?? 'updated', includeOwnerSorts: true);

        return $query->paginate($perPage);
    }

    /**
     * @param  Builder<Listing>  $query
     */
    private function applyTextSearch($query, string $term, bool $titleOnly = false): void
    {
        if ($query->getConnection()->getDriverName() === 'pgsql') {
            $query->where(function ($q) use ($term, $titleOnly): void {
                $q->where('title', 'ilike', "%{$term}%");
                if (! $titleOnly) {
                    $q->orWhere('description', 'ilike', "%{$term}%");
                }
            });

            return;
        }

        $needle = '%'.mb_strtolower($term).'%';
        $query->where(function ($q) use ($needle, $titleOnly): void {
            $q->whereRaw('LOWER(title) LIKE ?', [$needle]);
            if (! $titleOnly) {
                $q->orWhereRaw('LOWER(description) LIKE ?', [$needle]);
            }
        });
    }

    /**
     * Единая точка сортировки объявлений — «предусмотрены разные варианты».
     *
     * @param  Builder<Listing>  $query
     */
    private function applySort($query, ?string $sort, bool $includeOwnerSorts = false): void
    {
        $sort = match ($sort) {
            'new', 'newest' => 'newest',
            'cheap' => 'price_asc',
            'expensive' => 'price_desc',
            default => $sort,
        };

        match ($sort) {
            'newest' => $query->orderByDesc('published_at'),
            'oldest' => $query->orderBy('published_at'),
            'price_asc' => $query->orderBy('price_cents')->orderByDesc('published_at'),
            'price_desc' => $query->orderByDesc('price_cents')->orderByDesc('published_at'),
            'popular' => $query->orderByDesc('views_count')->orderByDesc('published_at'),
            'favorites' => $query->orderByDesc('favorites_count')->orderByDesc('published_at'),
            'updated' => $includeOwnerSorts ? $query->orderByDesc('updated_at') : $query->orderByDesc('published_at'),
            default => $query->orderByDesc('published_at'),
        };
    }

    /** Объявления, добавленные пользователем в избранное. */
    public function favorites(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Listing::query()
            ->with($this->relations())
            ->whereIn('id', function ($q) use ($user): void {
                $q->select('listing_id')->from('listing_favorites')->where('user_id', $user->id);
            })
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }

    public function addFavorite(Listing $listing, User $user): void
    {
        $inserted = DB::table('listing_favorites')->insertOrIgnore([
            'user_id' => $user->id,
            'listing_id' => $listing->id,
            'created_at' => now(),
        ]);

        if ($inserted) {
            $listing->increment('favorites_count');
        }
    }

    public function removeFavorite(Listing $listing, User $user): void
    {
        $deleted = DB::table('listing_favorites')
            ->where('user_id', $user->id)
            ->where('listing_id', $listing->id)
            ->delete();

        if ($deleted && $listing->favorites_count > 0) {
            $listing->decrement('favorites_count');
        }
    }

    public function findByUuid(string $uuid): Listing
    {
        $listing = Listing::query()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        return $listing;
    }

    public function show(string $uuid, ?User $viewer = null): Listing
    {
        $listing = Listing::query()
            ->with($this->relations())
            ->where('uuid', $uuid)
            ->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        if ($listing->status !== ListingStatus::Published) {
            if (! $viewer || $viewer->id !== $listing->user_id) {
                throw new NotFoundHttpException('Объявление не найдено.');
            }
        }

        return $listing;
    }

    /**
     * Count a view for a published listing. The owner's own views are ignored.
     */
    public function recordView(Listing $listing, ?User $viewer): void
    {
        if ($listing->status !== ListingStatus::Published) {
            return;
        }

        if ($viewer && $viewer->id === $listing->user_id) {
            return;
        }

        $who = $viewer ? 'u'.$viewer->id : 'ip'.request()->ip();
        if (! Cache::add('lv:'.$listing->id.':'.$who, 1, now()->addHours(6))) {
            return;
        }

        $listing->increment('views_count');
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Listing
    {
        $this->assertCategory($data['category_id'] ?? null);

        return DB::transaction(function () use ($user, $data): Listing {
            $slug = Str::slug($data['title']);
            $base = $slug !== '' ? $slug : 'listing';
            $slug = $base;
            $i = 1;
            while (Listing::query()->where('user_id', $user->id)->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }

            $publish = (bool) ($data['publish'] ?? true);

            $listing = Listing::create([
                'user_id' => $user->id,
                'category_id' => $data['category_id'],
                'subcategory_id' => $data['subcategory_id'] ?? null,
                'title' => $data['title'],
                'slug' => $slug,
                'description' => $data['description'],
                'price_cents' => (int) ($data['price_cents'] ?? 0),
                'city_id' => $data['city_id'] ?? null,
                'delivery_methods' => $data['delivery_methods'] ?? [],
                'status' => $publish ? ListingStatus::Published : ListingStatus::Draft,
                'published_at' => $publish ? now() : null,
            ]);

            $this->syncMedia($listing, $user, $data['media_ids'] ?? []);

            return $listing->fresh($this->relations());
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Listing $listing, User $user, array $data): Listing
    {
        $this->assertOwner($listing, $user);

        if (array_key_exists('category_id', $data) && $data['category_id'] !== null) {
            $this->assertCategory($data['category_id']);
        }

        return DB::transaction(function () use ($listing, $user, $data): Listing {
            $listing->fill(array_filter([
                'category_id' => $data['category_id'] ?? null,
                'subcategory_id' => $data['subcategory_id'] ?? null,
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'city_id' => $data['city_id'] ?? null,
            ], fn ($value) => $value !== null));

            if (array_key_exists('price_cents', $data)) {
                $listing->price_cents = (int) $data['price_cents'];
            }

            if (array_key_exists('delivery_methods', $data)) {
                $listing->delivery_methods = $data['delivery_methods'] ?? [];
            }

            $listing->save();

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($listing, $user, $data['media_ids'] ?? []);
            }

            return $listing->fresh($this->relations());
        });
    }

    public function setStatus(Listing $listing, User $user, ListingStatus $status): Listing
    {
        $this->assertOwner($listing, $user);

        $listing->status = $status;
        if ($status === ListingStatus::Published && $listing->published_at === null) {
            $listing->published_at = now();
        }
        $listing->save();

        return $listing->fresh($this->relations());
    }

    public function delete(Listing $listing, User $user): void
    {
        $this->assertOwner($listing, $user);
        $listing->delete();
    }

    public function findOwned(string $uuid, User $user): Listing
    {
        $listing = Listing::query()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        $this->assertOwner($listing, $user);

        return $listing;
    }

    /** @param list<string> $mediaUuids */
    private function syncMedia(Listing $listing, User $user, array $mediaUuids): void
    {
        $mediaUuids = array_values(array_unique($mediaUuids));

        if (count($mediaUuids) > 20) {
            throw ValidationException::withMessages([
                'media_ids' => ['Не более 20 файлов.'],
            ]);
        }

        $mediaIds = [];
        foreach ($mediaUuids as $uuid) {
            $media = Media::query()->where('uuid', $uuid)->first();
            if (! $media || $media->uploaded_by !== $user->id || ! $media->isReady()) {
                throw ValidationException::withMessages([
                    'media_ids' => ["Медиафайл {$uuid} недоступен."],
                ]);
            }
            $mediaIds[] = $media->id;
        }

        ListingMedia::query()->where('listing_id', $listing->id)->delete();

        foreach ($mediaIds as $index => $mediaId) {
            ListingMedia::create([
                'listing_id' => $listing->id,
                'media_id' => $mediaId,
                'sort_order' => $index,
            ]);
        }
    }

    private function assertOwner(Listing $listing, User $user): void
    {
        if ($listing->user_id !== $user->id && ! $user->isModerator()) {
            throw ValidationException::withMessages([
                'listing' => ['Нет доступа к объявлению.'],
            ]);
        }
    }

    private function assertCategory(?int $categoryId): void
    {
        if (! $categoryId || ! ListingCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
            throw ValidationException::withMessages([
                'category_id' => ['Категория не найдена.'],
            ]);
        }
    }
}
