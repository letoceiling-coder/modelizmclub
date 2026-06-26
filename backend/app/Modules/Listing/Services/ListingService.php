<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\ListingMedia;
use App\Models\Media;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
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

    public function list(array $filters, int $perPage = 20): LengthAwarePaginator
    {
        return Listing::query()
            ->with($this->relations())
            ->where('status', ListingStatus::Published)
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
            ->when($filters['subcategory_id'] ?? null, fn ($q, $id) => $q->where('subcategory_id', $id))
            ->when($filters['city_id'] ?? null, fn ($q, $id) => $q->where('city_id', $id))
            ->when($filters['q'] ?? null, function ($q, $term): void {
                $q->where(function ($q) use ($term): void {
                    $q->where('title', 'ilike', "%{$term}%")
                        ->orWhere('description', 'ilike', "%{$term}%");
                });
            })
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }

    public function myListings(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Listing::query()
            ->with($this->relations())
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->paginate($perPage);
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
