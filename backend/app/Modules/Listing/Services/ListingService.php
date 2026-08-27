<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingMedia;
use App\Models\Media;
use App\Models\ModerationQueue;
use App\Models\Payment;
use App\Models\Promocode;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\ParcelSize;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Modules\Listing\Support\ListingPlacementConfig;
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
     *  - taxonomy_id — ID из единого дерева (post_categories), включая потомков
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
            ->when($filters['city_id'] ?? null, fn ($q, $id) => $q->where('city_id', $id))
            ->when(! empty($filters['taxonomy_id']), function ($q) use ($filters): void {
                $ids = app(CategoryTaxonomyService::class)->listingIdsForPostCategory((int) $filters['taxonomy_id']);
                if ($ids === []) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->where(function ($q) use ($ids): void {
                    $q->whereIn('category_id', $ids)->orWhereIn('subcategory_id', $ids);
                });
            })
            ->when(empty($filters['taxonomy_id']) && ($filters['category_id'] ?? null), fn ($q, $id) => $q->where('category_id', $id))
            ->when(empty($filters['taxonomy_id']) && ($filters['subcategory_id'] ?? null), fn ($q, $id) => $q->where('subcategory_id', $id))
            ->when(empty($filters['taxonomy_id']) && ! empty($filters['category_ids']), fn ($q) => $q->whereIn('category_id', (array) $filters['category_ids']))
            ->when($filters['q'] ?? null, fn ($q, $term) => $this->applyTextSearch($q, (string) $term))
            ->when(isset($filters['price_min']), fn ($q) => $q->where('price_cents', '>=', (int) round(((float) $filters['price_min']) * 100)))
            ->when(isset($filters['price_max']), fn ($q) => $q->where('price_cents', '<=', (int) round(((float) $filters['price_max']) * 100)))
            ->when($filters['delivery_method'] ?? null, fn ($q, $method) => $q->whereJsonContains('delivery_methods', $method))
            ->when(($filters['has_media'] ?? null) === true, fn ($q) => $q->whereHas('mediaItems'))
            ->when(($filters['has_media'] ?? null) === false, fn ($q) => $q->whereDoesntHave('mediaItems'));

        $this->applySort($query, $filters['sort'] ?? 'newest');

        return $query->paginate($perPage);
    }

    /** Published listings for a user's public profile. */
    public function publicByUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Listing::query()
            ->with($this->relations())
            ->where('user_id', $user->id)
            ->where('status', ListingStatus::Published)
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Объявления текущего пользователя. Можно фильтровать по статусу и сортировать.
     *
     * @param  array<string, mixed>  $filters
     */
    public function myListings(User $user, array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Listing::query()
            ->withTrashed()
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

        app(\Modules\Listing\Services\SellerStatsService::class)->recordDailyView($listing);
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Listing
    {
        $this->assertCategory($data['category_id'] ?? null);
        $this->assertDeliveryDetails($data);
        $data = $this->normalizeParcelFields($data);

        return DB::transaction(function () use ($user, $data): Listing {
            $slug = Str::slug($data['title']);
            $base = $slug !== '' ? $slug : 'listing';
            $slug = $base;
            $i = 1;
            while (Listing::query()->where('user_id', $user->id)->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }

            $publish = (bool) ($data['publish'] ?? true);
            [$status, $publishedAt, $placementMeta] = $this->resolveCreateStatus($user, $publish, $data);

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
                'package_size' => $data['package_size'] ?? null,
                'weight_kg' => $data['weight_kg'] ?? null,
                'dimensions_cm' => $data['dimensions_cm'] ?? null,
                'pickup_address' => $data['pickup_address'] ?? null,
                'status' => $status,
                'published_at' => $publishedAt,
                'placement_payment_id' => $placementMeta['placement_payment_id'] ?? null,
                'placement_amount_cents' => $placementMeta['placement_amount_cents'] ?? null,
                'placement_was_free' => $placementMeta['placement_was_free'] ?? false,
                'placement_promocode_id' => $placementMeta['placement_promocode_id'] ?? null,
            ]);

            if (($placementMeta['record_promocode'] ?? null) instanceof Promocode) {
                app(\Modules\Billing\Services\PromocodeService::class)
                    ->recordUsage($placementMeta['record_promocode'], $user, $placementMeta['placement_payment_id'] ?? null);
            }

            $this->syncMedia($listing, $user, $data['media_ids'] ?? []);

            if ($status === ListingStatus::PendingModeration) {
                $this->enqueueModeration($listing);
            }

            return $listing->fresh($this->relations());
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Listing $listing, User $user, array $data): Listing
    {
        $this->assertOwner($listing, $user);
        $this->assertDeliveryDetails(array_merge([
            'delivery_methods' => $listing->delivery_methods,
            'package_size' => $listing->package_size,
            'weight_kg' => $listing->weight_kg,
            'dimensions_cm' => $listing->dimensions_cm,
            'pickup_address' => $listing->pickup_address,
        ], $data), true);
        $data = $this->normalizeParcelFields($data);

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
            if (array_key_exists('package_size', $data)) {
                $listing->package_size = $data['package_size'];
            }
            if (array_key_exists('weight_kg', $data)) {
                $listing->weight_kg = $data['weight_kg'];
            }
            if (array_key_exists('dimensions_cm', $data)) {
                $listing->dimensions_cm = $data['dimensions_cm'];
            }
            if (array_key_exists('pickup_address', $data)) {
                $listing->pickup_address = $data['pickup_address'];
            }

            $listing->save();

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($listing, $user, $data['media_ids'] ?? []);
            }

            if (in_array($listing->status, [ListingStatus::Published, ListingStatus::Revision], true)) {
                $listing->update([
                    'status' => ListingStatus::PendingModeration,
                    'published_at' => null,
                ]);
                $this->enqueueModeration($listing);
            }

            return $listing->fresh($this->relations());
        });
    }

    public function setStatus(Listing $listing, User $user, ListingStatus $status, array $context = []): Listing
    {
        $this->assertOwner($listing, $user);

        if ($status === ListingStatus::Published && $listing->status !== ListingStatus::Published) {
            [$resolvedStatus, $publishedAt, $placementMeta] = $this->resolveCreateStatus($user, true, array_merge([
                'category_id' => $listing->category_id,
                'subcategory_id' => $listing->subcategory_id,
            ], $context));
            $listing->placement_payment_id = $placementMeta['placement_payment_id'] ?? $listing->placement_payment_id;
            $listing->placement_amount_cents = $placementMeta['placement_amount_cents'] ?? $listing->placement_amount_cents;
            $listing->placement_was_free = $placementMeta['placement_was_free'] ?? $listing->placement_was_free;
            $listing->placement_promocode_id = $placementMeta['placement_promocode_id'] ?? $listing->placement_promocode_id;

            if (($placementMeta['record_promocode'] ?? null) instanceof Promocode) {
                app(\Modules\Billing\Services\PromocodeService::class)
                    ->recordUsage($placementMeta['record_promocode'], $user, $placementMeta['placement_payment_id'] ?? null);
            }

            $status = $resolvedStatus;
            if ($publishedAt !== null) {
                $listing->published_at = $publishedAt;
            } elseif ($status === ListingStatus::PendingModeration) {
                $listing->published_at = null;
            }
        }

        $listing->status = $status;
        if ($status === ListingStatus::Published && $listing->published_at === null) {
            $listing->published_at = now();
        }
        $listing->save();

        if ($status === ListingStatus::PendingModeration) {
            $this->enqueueModeration($listing);
        }

        return $listing->fresh($this->relations());
    }

    /**
     * Whether new listings should be auto-published (moderation OFF).
     * Controlled by admin `moderation_auto_publish` SystemSetting (JSON `{ "enabled": bool }`).
     */
    public function autoPublishEnabled(): bool
    {
        $setting = SystemSetting::query()
            ->where('key', 'moderation_auto_publish')
            ->value('value');

        if (is_array($setting) && array_key_exists('enabled', $setting)) {
            return (bool) $setting['enabled'];
        }

        return false;
    }

    public function markPublished(Listing $listing): void
    {
        $already = $listing->status === ListingStatus::Published;

        $listing->update([
            'status' => ListingStatus::Published,
            'published_at' => $listing->published_at ?? now(),
        ]);

        ModerationQueue::query()
            ->where('moderatable_type', Listing::class)
            ->where('moderatable_id', $listing->id)
            ->update(['status' => 'approved']);

        if (! $already) {
            $owner = $listing->author ?? User::query()->find($listing->user_id);
            if ($owner) {
                InAppNotify::sendQuiet(
                    $owner,
                    new InAppNotification(
                        'listings',
                        'Объявление опубликовано',
                        (string) $listing->title,
                        '/ads/'.$listing->uuid,
                    ),
                );
            }
        }
    }

    /** Apply moderation gate after placement/payment is resolved. */
    public function finalizeAfterPlacement(Listing $listing): Listing
    {
        if ($this->autoPublishEnabled()) {
            $this->markPublished($listing);
        } else {
            $listing->update([
                'status' => ListingStatus::PendingModeration,
                'published_at' => null,
            ]);
            $this->enqueueModeration($listing);
        }

        return $listing->fresh();
    }

    public function enqueueModeration(Listing $listing): void
    {
        ModerationQueue::query()->updateOrCreate(
            [
                'moderatable_type' => Listing::class,
                'moderatable_id' => $listing->id,
            ],
            [
                'queue' => 'listings',
                'priority' => 0,
                'status' => 'pending',
            ],
        );
    }

    public function delete(Listing $listing, User $user): void
    {
        $this->assertOwner($listing, $user);
        $listing->delete();
    }

    public function restore(Listing $listing, User $user): Listing
    {
        $this->assertOwner($listing, $user);

        if (! $listing->trashed()) {
            throw ValidationException::withMessages([
                'listing' => ['Объявление не удалено.'],
            ]);
        }

        $listing->restore();

        return $listing->fresh($this->relations());
    }

    public function findOwnedTrashed(string $uuid, User $user): Listing
    {
        $listing = Listing::onlyTrashed()->where('uuid', $uuid)->first();

        if (! $listing) {
            throw new NotFoundHttpException('Объявление не найдено.');
        }

        $this->assertOwner($listing, $user);

        return $listing;
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

    /** @return array{0: ListingStatus, 1: \Illuminate\Support\Carbon|null, 2: array<string, mixed>} */
    private function resolveCreateStatus(User $user, bool $publish, array $data = []): array
    {
        if (! $publish) {
            return [ListingStatus::Draft, null, []];
        }

        if (! ListingPlacementConfig::paymentEnabled()) {
            [$status, $publishedAt] = $this->gatePublishStatus();

            return [$status, $publishedAt, ['placement_was_free' => true, 'placement_amount_cents' => 0]];
        }

        $pricing = app(ListingPlacementPricingService::class);
        $quote = $pricing->quote(
            $user,
            isset($data['category_id']) ? (int) $data['category_id'] : null,
            isset($data['subcategory_id']) ? (int) $data['subcategory_id'] : null,
            $data['promocode'] ?? null,
        );

        if (($quote['promocode']['error'] ?? null) !== null) {
            throw ValidationException::withMessages([
                'promocode' => [$quote['promocode']['error']],
            ]);
        }

        $promocode = null;
        if (isset($quote['promocode']['id'])) {
            $promocode = Promocode::query()->find($quote['promocode']['id']);
        }

        if ($quote['final_cents'] === 0) {
            [$status, $publishedAt] = $this->gatePublishStatus();

            return [
                $status,
                $publishedAt,
                [
                    'placement_was_free' => true,
                    'placement_amount_cents' => 0,
                    'placement_promocode_id' => $promocode?->id,
                    'record_promocode' => $promocode,
                ],
            ];
        }

        $paymentUuid = $data['placement_payment_uuid'] ?? null;
        if ($paymentUuid) {
            $payment = Payment::query()
                ->where('uuid', $paymentUuid)
                ->where('user_id', $user->id)
                ->where('status', 'paid')
                ->first();

            if ($payment && ($payment->metadata['payable_type'] ?? null) === 'listing_placement') {
                [$status, $publishedAt] = $this->gatePublishStatus();

                return [
                    $status,
                    $publishedAt,
                    [
                        'placement_payment_id' => $payment->id,
                        'placement_amount_cents' => $payment->amount_cents,
                        'placement_was_free' => false,
                        'placement_promocode_id' => $promocode?->id ?? ($payment->metadata['promocode_id'] ?? null),
                        'record_promocode' => $promocode,
                    ],
                ];
            }
        }

        $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

        if ($locked->listing_placement_credits >= 1) {
            $locked->decrement('listing_placement_credits');

            [$status, $publishedAt] = $this->gatePublishStatus();

            return [
                $status,
                $publishedAt,
                [
                    'placement_was_free' => false,
                    'placement_amount_cents' => $quote['final_cents'],
                ],
            ];
        }

        throw ValidationException::withMessages([
            'publish' => ['Для публикации объявления нужна оплата.'],
        ])->errorBag('default');
    }

    /** @return array{0: ListingStatus, 1: \Illuminate\Support\Carbon|null} */
    private function gatePublishStatus(): array
    {
        if ($this->autoPublishEnabled()) {
            return [ListingStatus::Published, now()];
        }

        return [ListingStatus::PendingModeration, null];
    }

    /** @param  array<string, mixed>  $data */
    private function assertDeliveryDetails(array $data, bool $updating = false): void
    {
        $methods = $data['delivery_methods'] ?? [];
        if (! is_array($methods)) {
            return;
        }

        if (ParcelSize::offersCdek($methods)) {
            $preset = is_string($data['package_size'] ?? null) ? strtolower((string) $data['package_size']) : '';
            $dims = is_array($data['dimensions_cm'] ?? null) ? $data['dimensions_cm'] : [];
            $hasCustom = (int) ($dims['length'] ?? 0) > 0
                && (int) ($dims['width'] ?? 0) > 0
                && (int) ($dims['height'] ?? 0) > 0
                && (float) ($data['weight_kg'] ?? 0) > 0;
            if ($preset === '' && ! $hasCustom) {
                throw ValidationException::withMessages([
                    'package_size' => ['Для доставки СДЭК укажите типоразмер S/M/L или габариты и вес посылки.'],
                ]);
            }
        }

        if (ParcelSize::offersPickup($methods) && trim((string) ($data['pickup_address'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'pickup_address' => ['Укажите адрес или ориентир для самовывоза.'],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeParcelFields(array $data): array
    {
        $methods = $data['delivery_methods'] ?? [];
        if (! ParcelSize::offersCdek(is_array($methods) ? $methods : [])) {
            return $data;
        }

        $parcel = ParcelSize::resolve(
            is_string($data['package_size'] ?? null) ? $data['package_size'] : null,
            is_array($data['dimensions_cm'] ?? null) ? $data['dimensions_cm'] : null,
            $data['weight_kg'] ?? null,
        );
        $data['package_size'] = $parcel['package_size'];
        $data['dimensions_cm'] = $parcel['dimensions_cm'];
        $data['weight_kg'] = $parcel['weight_kg'];

        return $data;
    }
}
