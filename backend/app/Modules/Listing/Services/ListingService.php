<?php

namespace Modules\Listing\Services;

use App\Enums\DeliveryCarrier;
use App\Enums\ListingStatus;
use App\Enums\SafeDealStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingMedia;
use App\Models\Media;
use App\Models\ModerationQueue;
use App\Models\Payment;
use App\Models\Promocode;
use App\Models\SafeDeal;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\InAppNotify;
use App\Support\ParcelSize;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Billing\Services\PromocodeService;
use Modules\Catalog\Services\CategoryTaxonomyService;
use Modules\Delivery\Services\SellerDeliveryProfileService;
use Modules\Listing\Support\ListingPlacementConfig;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ListingService
{
    /** @return list<string> */
    private function relations(): array
    {
        return ['author.profile.avatar', 'category', 'subcategory', 'city', 'mediaItems.media', 'placementPayment'];
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
            /*
             * Идентификатор берётся из массива, а не из второго аргумента
             * `when`. Условие здесь составное, а `&&` возвращает логическое
             * значение — в замыкание приходил `true`, и отбор превращался в
             * `category_id = true`. Каталог отвечал пустотой на любую
             * выбранную категорию: 0 объявлений там, где в базе их 18.
             */
            ->when(
                empty($filters['taxonomy_id']) && ! empty($filters['category_id']),
                fn ($q) => $q->where('category_id', (int) $filters['category_id'])
            )
            ->when(
                empty($filters['taxonomy_id']) && ! empty($filters['subcategory_id']),
                fn ($q) => $q->where('subcategory_id', (int) $filters['subcategory_id'])
            )
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
     * Last distinct pickup addresses the seller already used on listings.
     *
     * @return list<string>
     */
    public function recentPickupAddresses(User $user, int $limit = 3): array
    {
        $limit = max(1, min(3, $limit));
        $rows = Listing::query()
            ->withTrashed()
            ->where('user_id', $user->id)
            ->whereNotNull('pickup_address')
            ->where('pickup_address', '!=', '')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(30)
            ->pluck('pickup_address');

        $out = [];
        $seen = [];
        foreach ($rows as $raw) {
            $label = trim((string) $raw);
            if (mb_strlen($label) < 3) {
                continue;
            }
            $key = mb_strtolower($label);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $label;
            if (count($out) >= $limit) {
                break;
            }
        }

        return $out;
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

        app(SellerStatsService::class)->recordDailyView($listing);
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): Listing
    {
        $data = $this->resolveCategoryIds($data);
        $this->assertCategory($data['category_id'] ?? null);
        $this->assertDeliveryDetails($data, false, $user);
        $data = $this->normalizeParcelFields($data);

        return DB::transaction(function () use ($user, $data): Listing {
            $slug = $this->uniqueSlug($user, (string) $data['title']);

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
                'condition' => $data['condition'] ?? null,
                'city_id' => $data['city_id'] ?? null,
                'delivery_methods' => $data['delivery_methods'] ?? [],
                'weight_kg' => $data['weight_kg'] ?? null,
                'dimensions_cm' => $data['dimensions_cm'] ?? null,
                'pickup_address' => $data['pickup_address'] ?? null,
                'show_phone' => (bool) ($data['show_phone'] ?? true),
                'status' => $status,
                'published_at' => $publishedAt,
                'placement_payment_id' => $placementMeta['placement_payment_id'] ?? null,
                'placement_amount_cents' => $placementMeta['placement_amount_cents'] ?? null,
                'placement_was_free' => $placementMeta['placement_was_free'] ?? false,
                'placement_free_reason' => $placementMeta['placement_free_reason'] ?? null,
                'placement_covered_at' => $placementMeta === [] ? null : now(),
                'placement_promocode_id' => $placementMeta['placement_promocode_id'] ?? null,
            ]);

            if (($placementMeta['record_promocode'] ?? null) instanceof Promocode) {
                app(PromocodeService::class)
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
        $this->assertAuthor($listing, $user);
        $this->assertDeliveryDetails(array_merge([
            'delivery_methods' => $listing->delivery_methods,
            'weight_kg' => $listing->weight_kg,
            'dimensions_cm' => $listing->dimensions_cm,
            'pickup_address' => $listing->pickup_address,
            'city_id' => $listing->city_id,
        ], $data), true, $user);
        $data = $this->normalizeParcelFields($data, $listing);

        if (! empty($data['taxonomy_id']) || (array_key_exists('category_id', $data) && $data['category_id'] !== null)) {
            $data = $this->resolveCategoryIds($data);
            $this->assertCategory($data['category_id'] ?? null);
        }

        return DB::transaction(function () use ($listing, $user, $data): Listing {
            $listing->fill(array_filter([
                'category_id' => $data['category_id'] ?? null,
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'city_id' => $data['city_id'] ?? null,
            ], fn ($value) => $value !== null));

            if (array_key_exists('subcategory_id', $data)) {
                $listing->subcategory_id = $data['subcategory_id'];
            }

            if (array_key_exists('price_cents', $data)) {
                $listing->price_cents = (int) $data['price_cents'];
            }

            if (array_key_exists('condition', $data)) {
                $listing->condition = $data['condition'];
            }

            if (array_key_exists('delivery_methods', $data)) {
                $listing->delivery_methods = $data['delivery_methods'] ?? [];
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
            if (array_key_exists('show_phone', $data)) {
                $listing->show_phone = (bool) $data['show_phone'];
            }

            $listing->save();

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($listing, $user, $data['media_ids'] ?? []);
            }

            // Any edit of a live (or previously rejected) listing must be reviewed again
            // before it is visible in the catalog. See docs/qa/modelizm-43-fixes.md #10.
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
        // Снять с публикации может и модерация площадки; публиковать — только автор.
        if ($status === ListingStatus::Unpublished) {
            $this->assertOwner($listing, $user);
        } else {
            $this->assertAuthor($listing, $user);
        }

        return DB::transaction(function () use ($listing, $user, $status, $context): Listing {
            /*
             * Под замком строки объявления и с перечитанным статусом: два
             * быстрых «Опубликовать» по одному черновику иначе оба видели
             * «не опубликовано» и оба тратили квоту или кредит (ревью 19.09).
             */
            $listing = Listing::query()->lockForUpdate()->findOrFail($listing->id);

            /*
             * За уже оплаченное размещение второй раз не берём.
             *
             * Публикация из черновика шла через resolveCreateStatus, а он считает
             * котировку заново и про привязанный платёж не знает. Человек платил,
             * снимал объявление с публикации, публиковал снова — и платил опять
             * (приёмка 16.09). Платёж проверяется по самому объявлению, поэтому
             * переживает и возврат в черновик, и снятие с публикации.
             */
            if (
                $status === ListingStatus::Published
                && $listing->status !== ListingStatus::Published
                && app(ListingPlacementPricingService::class)->listingPlacementPaid($listing, $user)
            ) {
                [$resolvedStatus, $publishedAt] = $this->gatePublishStatus();
                $listing->status = $resolvedStatus;
                $listing->published_at = $publishedAt;
                $listing->save();

                if ($resolvedStatus === ListingStatus::PendingModeration) {
                    $this->enqueueModeration($listing);
                }

                return $listing->fresh($this->relations());
            }

            if ($status === ListingStatus::Published && $listing->status !== ListingStatus::Published) {
                // Категория и адрес объявления — из самого объявления, после
                // контекста запроса: их нельзя подменить параметрами публикации.
                [$resolvedStatus, $publishedAt, $placementMeta] = $this->resolveCreateStatus($user, true, array_merge($context, [
                    'category_id' => $listing->category_id,
                    'subcategory_id' => $listing->subcategory_id,
                    'listing_uuid' => $listing->uuid,
                ]));
                $listing->placement_payment_id = $placementMeta['placement_payment_id'] ?? $listing->placement_payment_id;
                $listing->placement_amount_cents = $placementMeta['placement_amount_cents'] ?? $listing->placement_amount_cents;
                $listing->placement_was_free = $placementMeta['placement_was_free'] ?? $listing->placement_was_free;
                if (array_key_exists('placement_free_reason', $placementMeta)) {
                    $listing->placement_free_reason = $placementMeta['placement_free_reason'];
                }
                if ($placementMeta !== []) {
                    $listing->placement_covered_at = now();
                }
                $listing->placement_promocode_id = $placementMeta['placement_promocode_id'] ?? $listing->placement_promocode_id;

                if (($placementMeta['record_promocode'] ?? null) instanceof Promocode) {
                    app(PromocodeService::class)
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
        });
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

    /**
     * Удаление объявления.
     *
     * Пока по объявлению идёт сделка, удалять его нельзя: покупатель уже
     * заплатил или вот-вот заплатит, а карточка сделки осталась бы со ссылкой
     * в никуда. До 07.09 проверки не было — на проде так появилась завершённая
     * сделка с удалённым лотом.
     *
     * Неоплаченные сделки в `created` при этом не держат объявление вечно: их
     * гасит `safe-deals:auto-release`, и продавец может отменить свою сделку
     * сам, а затем удалить лот.
     */
    public function delete(Listing $listing, User $user): void
    {
        $this->assertOwner($listing, $user);

        $live = SafeDeal::query()
            ->where('listing_id', $listing->id)
            ->whereIn('status', [
                SafeDealStatus::Created,
                SafeDealStatus::Paid,
                SafeDealStatus::Shipped,
                SafeDealStatus::Delivered,
                SafeDealStatus::Disputed,
            ])
            ->count();

        if ($live > 0) {
            throw ValidationException::withMessages([
                'listing' => [$live === 1
                    ? 'По объявлению идёт безопасная сделка — сначала завершите или отмените её.'
                    : "По объявлению идут безопасные сделки ({$live}) — сначала завершите или отмените их.",
                ],
            ]);
        }

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

        /*
         * Пока объявление лежало удалённым, очередь помечала его запись
         * отменённой (ModerationService::cancelOrphanedEntries). После
         * восстановления статус «на модерации» оставался, а задачи у
         * модератора не было — счётчик очереди показывал ноль при непустом
         * списке «на модерации» (приёмка 16.09).
         */
        if ($listing->status === ListingStatus::PendingModeration) {
            $this->enqueueModeration($listing);
        }

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

    /**
     * Правка и публикация — только автор. До 17.09 и здесь проходил модератор
     * площадки: мог переписать чужое объявление и опубликовать его.
     */
    private function assertAuthor(Listing $listing, User $user): void
    {
        if ($listing->user_id !== $user->id) {
            throw ValidationException::withMessages([
                'listing' => ['Нет доступа к объявлению.'],
            ]);
        }
    }

    /** Автор или модерация площадки: снять, удалить, вернуть, посмотреть. */
    private function assertOwner(Listing $listing, User $user): void
    {
        if ($listing->user_id !== $user->id && ! $user->isModerator()) {
            throw ValidationException::withMessages([
                'listing' => ['Нет доступа к объявлению.'],
            ]);
        }
    }

    private function uniqueSlug(User $user, string $title): string
    {
        $slug = Str::slug($title);
        $base = $slug !== '' ? $slug : 'listing';
        $candidate = $base;
        $i = 1;
        while (Listing::withTrashed()->where('user_id', $user->id)->where('slug', $candidate)->exists()) {
            $candidate = $base.'-'.$i++;
        }

        return $candidate;
    }

    /** @param array<string, mixed> $data */
    private function resolveCategoryIds(array $data): array
    {
        $pair = app(CategoryTaxonomyService::class)->resolveListingCategoryInput(
            isset($data['category_id']) ? (int) $data['category_id'] : null,
            isset($data['subcategory_id']) ? (int) $data['subcategory_id'] : null,
            isset($data['taxonomy_id']) ? (int) $data['taxonomy_id'] : null,
        );
        $data['category_id'] = $pair['category_id'];
        $data['subcategory_id'] = $pair['subcategory_id'];
        unset($data['taxonomy_id']);

        return $data;
    }

    private function assertCategory(?int $categoryId): void
    {
        if (! $categoryId || ! ListingCategory::query()->whereKey($categoryId)->where('is_active', true)->exists()) {
            throw ValidationException::withMessages([
                'category_id' => ['Категория не найдена.'],
            ]);
        }
    }

    /** @return array{0: ListingStatus, 1: Carbon|null, 2: array<string, mixed>} */
    private function resolveCreateStatus(User $user, bool $publish, array $data = []): array
    {
        if (! $publish) {
            return [ListingStatus::Draft, null, []];
        }

        if (! ListingPlacementConfig::paymentEnabled()) {
            [$status, $publishedAt] = $this->gatePublishStatus();

            return [$status, $publishedAt, ['placement_was_free' => true, 'placement_amount_cents' => 0]];
        }

        /*
         * Размещения одного человека — по очереди. Строка пользователя под
         * замком до конца транзакции создания или публикации: квота тарифа
         * считается по уже размещённым объявлениям, и без замка параллельные
         * запросы видели бы один и тот же остаток (ревью 19.09).
         */
        User::query()->whereKey($user->id)->lockForUpdate()->first();

        $quote = $this->placementQuote($user, $data);

        /*
         * Персональная квота — первой (решение 19.09). Котировка её только
         * показывает, списывает создание: условным UPDATE, как кредит. Если
         * единицу успели потратить, котировка считается заново — дальше по
         * порядку: тариф, кредит, оплата. Если заново снова вышла квота
         * (Владелец как раз её пополнил), списание пробуется ещё раз — без
         * списания бесплатным размещение не становится.
         */
        $attempts = 0;
        while (($quote['free_reason'] ?? null) === 'personal_quota' && ! $this->consumePersonalQuota($user)) {
            if (++$attempts >= 3) {
                throw ValidationException::withMessages([
                    'publish' => ['Не удалось списать бесплатное размещение. Попробуйте ещё раз.'],
                ]);
            }
            $user->refresh();
            $quote = $this->placementQuote($user, $data);
        }

        $promocode = null;
        if (isset($quote['promocode']['id'])) {
            $promocode = Promocode::query()->find($quote['promocode']['id']);
        }

        /*
         * Нулевую цену даёт и кредит размещения — `quote()` показывает его как
         * бесплатность, но сам кредит не трогает: котировку открывают просто
         * посмотреть. Списывать надо здесь, в транзакции создания объявления.
         * До 15.09 эта ветка возвращала «бесплатно», а списание стояло ниже и
         * не достигалось: один кредит давал сколько угодно объявлений.
         *
         * Списание условным UPDATE, а не чтением и записью: две вкладки с одним
         * кредитом не должны опубликовать два объявления. Если кредит успел
         * кончиться, объявление ждёт оплату по цене без кредита.
         */
        if ($quote['final_cents'] === 0 && ($quote['free_reason'] ?? null) === 'listing_credit') {
            $consumed = User::query()
                ->whereKey($user->id)
                ->where('listing_placement_credits', '>=', 1)
                ->decrement('listing_placement_credits');

            $pricedCents = (int) $quote['price_cents'];

            if ($consumed === 1) {
                [$status, $publishedAt] = $this->gatePublishStatus();

                // Не «бесплатно»: кредит — оплаченная заранее единица, и в
                // квоту бесплатных размещений подписки он не засчитывается.
                return [
                    $status,
                    $publishedAt,
                    [
                        'placement_was_free' => false,
                        'placement_amount_cents' => $pricedCents,
                        'placement_free_reason' => null,
                    ],
                ];
            }

            $quote['final_cents'] = $pricedCents;
        }

        if ($quote['final_cents'] === 0) {
            [$status, $publishedAt] = $this->gatePublishStatus();

            return [
                $status,
                $publishedAt,
                [
                    'placement_was_free' => true,
                    'placement_amount_cents' => 0,
                    'placement_free_reason' => $quote['free_reason'] ?? null,
                    // Квота покрыла размещение раньше промокода — промокод не
                    // потрачен и в использованные не записывается.
                    'placement_promocode_id' => $this->promoSpent($quote) ? $promocode?->id : null,
                    'record_promocode' => $this->promoSpent($quote) ? $promocode : null,
                ],
            ];
        }

        $paymentUuid = $data['placement_payment_uuid'] ?? null;
        if ($paymentUuid) {
            $payment = Payment::query()
                ->where('uuid', $paymentUuid)
                ->where('user_id', $user->id)
                ->where('status', 'paid')
                ->lockForUpdate()
                ->first();

            if ($payment && $this->paymentCoversListing($payment, $data['listing_uuid'] ?? null, (int) $quote['final_cents'])) {
                [$status, $publishedAt] = $this->gatePublishStatus();

                return [
                    $status,
                    $publishedAt,
                    [
                        'placement_payment_id' => $payment->id,
                        'placement_amount_cents' => $payment->amount_cents,
                        'placement_was_free' => false,
                        'placement_free_reason' => null,
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
                    'placement_free_reason' => null,
                ],
            ];
        }

        throw ValidationException::withMessages([
            'publish' => ['Для публикации объявления нужна оплата.'],
        ])->errorBag('default');
    }

    /**
     * Котировка для создания объявления; ошибка промокода — отказ.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function placementQuote(User $user, array $data): array
    {
        $quote = app(ListingPlacementPricingService::class)->quote(
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

        return $quote;
    }

    /**
     * Годится ли оплаченный платёж для размещения этого объявления.
     *
     * До 19.09 принимался любой оплаченный платёж за размещение по его uuid:
     * без проверки, что он не потрачен на другое объявление и не стал
     * кредитом. Одна оплата прямым запросом публиковала сколько угодно
     * объявлений (ревью 19.09). Интерфейс этот параметр не шлёт вовсе —
     * платёж мастера привязан к черновику и закрепляется при оплате
     * (PaymentFulfillmentService). Поэтому платёж засчитывается, только если
     * он оформлен на это самое объявление, не стал кредитом, не закреплён за
     * другим объявлением и покрывает текущую цену.
     */
    private function paymentCoversListing(Payment $payment, ?string $listingUuid, int $priceCents): bool
    {
        $metadata = is_array($payment->metadata) ? $payment->metadata : [];

        if (($metadata['payable_type'] ?? null) !== 'listing_placement') {
            return false;
        }
        if ($listingUuid === null || ($metadata['listing_uuid'] ?? null) !== $listingUuid) {
            return false;
        }
        if (($metadata['granted_listing_credit'] ?? false) === true) {
            return false;
        }
        if ((int) $payment->amount_cents < $priceCents) {
            return false;
        }

        return Listing::withTrashed()
            ->where('placement_payment_id', $payment->id)
            ->where('uuid', '!=', $listingUuid)
            ->doesntExist();
    }

    /** Списать единицу персональной квоты; «без ограничения» тоже считается. */
    private function consumePersonalQuota(User $user): bool
    {
        return User::query()
            ->whereKey($user->id)
            ->where(function ($q): void {
                $q->where('free_listings_unlimited', true)
                    ->orWhereColumn('free_listings_used', '<', 'free_listings_quota');
            })
            ->increment('free_listings_used') === 1;
    }

    /**
     * Промокод потрачен, только если это он сделал цену нулевой. Когда
     * размещение покрыла квота, промокод остаётся человеку.
     *
     * @param  array<string, mixed>  $quote
     */
    private function promoSpent(array $quote): bool
    {
        return in_array($quote['free_reason'] ?? null, ['promocode', 'subscriber_price', 'free_category'], true)
            && (int) ($quote['promo_discount_cents'] ?? 0) > 0;
    }

    /** @return array{0: ListingStatus, 1: Carbon|null} */
    private function gatePublishStatus(): array
    {
        if ($this->autoPublishEnabled()) {
            return [ListingStatus::Published, now()];
        }

        return [ListingStatus::PendingModeration, null];
    }

    /** @param  array<string, mixed>  $data */
    /**
     * Всё, чего не хватает объявлению для выбранных способов доставки.
     *
     * Ошибки собираются и выбрасываются разом: продавцу незачем узнавать про
     * забытый город после того, как он вернулся и дозаполнил габариты.
     */
    private function assertDeliveryDetails(array $data, bool $updating = false, ?User $seller = null): void
    {
        $methods = $data['delivery_methods'] ?? [];
        if (! is_array($methods)) {
            return;
        }

        $errors = [];

        if (ParcelSize::offersCdek($methods)) {
            /*
             * Габариты и вес обязательны — все четыре значения.
             *
             * До 22.09 их заменял типоразмер S/M/L, за которым стояла
             * придуманная коробка. Тариф считался по ней, в пункт приёма
             * приезжала настоящая, и разницу доплачивала площадка.
             *
             * Отказ называет недостающее поимённо, а не одной строкой на все
             * четыре: «укажите габариты» на форме, где заполнено три поля из
             * четырёх, не говорит человеку, какое поле осталось.
             */
            $dims = is_array($data['dimensions_cm'] ?? null) ? $data['dimensions_cm'] : [];
            foreach (['length' => 'длину', 'width' => 'ширину', 'height' => 'высоту'] as $key => $что) {
                if ((int) ($dims[$key] ?? 0) <= 0) {
                    $errors['dimensions_cm.'.$key] = ['Для доставки СДЭК укажите '.$что.' посылки в сантиметрах.'];
                }
            }
            if ((float) ($data['weight_kg'] ?? 0) <= 0) {
                $errors['weight_kg'] = ['Для доставки СДЭК укажите вес посылки в килограммах.'];
            }

            // Город отправки нужен СДЭК, чтобы вообще посчитать тариф. Раньше
            // это не проверялось нигде: объявление публиковалось без него, а
            // отказ «Продавец не указал город отправки» получал покупатель,
            // уже открывший оформление сделки. Спрашиваем у того, кто может
            // исправить.
            if ($seller !== null) {
                $hasProfile = app(SellerDeliveryProfileService::class)
                    ->defaultFor($seller, DeliveryCarrier::Cdek) !== null;

                if (! $hasProfile && (int) ($data['city_id'] ?? 0) <= 0) {
                    $errors['city_id'] = ['Для доставки СДЭК укажите город отправки или добавьте пункт в профиле доставки.'];
                }
            }
        }

        if (ParcelSize::offersPickup($methods) && trim((string) ($data['pickup_address'] ?? '')) === '') {
            $errors['pickup_address'] = ['Укажите адрес или ориентир для самовывоза.'];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeParcelFields(array $data, ?Listing $listing = null): array
    {
        $methods = array_key_exists('delivery_methods', $data)
            ? $data['delivery_methods']
            : $listing?->delivery_methods;

        if (! ParcelSize::offersCdek(is_array($methods) ? $methods : [])) {
            return $data;
        }

        /*
         * Трогаем только то, что прислали.
         *
         * Правка частичная: `PATCH /listings/{uuid}` с одними способами
         * доставки — обычное дело. Нормализация всего подряд превращала такой
         * запрос в затирание измеренной коробки полом в единицу: 45×30×20 см
         * и 6,5 кг становились 1×1×1 см и 10 граммами, ответ 200, а тариф
         * СДЭК со следующей сделки считался за кубический сантиметр. Ровно
         * та потеря, ради которой убирали типоразмеры.
         *
         * Проверка выше этого не ловит: она смотрит слитые данные, где
         * габариты берутся из объявления и всё на месте.
         */
        $parcel = ParcelSize::resolve(
            array_key_exists('dimensions_cm', $data)
                ? (is_array($data['dimensions_cm']) ? $data['dimensions_cm'] : null)
                : (is_array($listing?->dimensions_cm) ? $listing->dimensions_cm : null),
            array_key_exists('weight_kg', $data) ? $data['weight_kg'] : $listing?->weight_kg,
        );

        if (array_key_exists('dimensions_cm', $data)) {
            $data['dimensions_cm'] = $parcel['dimensions_cm'];
        }
        if (array_key_exists('weight_kg', $data)) {
            $data['weight_kg'] = $parcel['weight_kg'];
        }

        return $data;
    }
}
