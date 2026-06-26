<?php

namespace Modules\Listing\Services;

use App\Enums\ListingStatus;
use App\Models\Listing;
use App\Models\ListingCategory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ListingService
{
    public function list(array $filters, int $perPage = 20): LengthAwarePaginator
    {
        return Listing::query()
            ->with(['author.profile', 'category', 'subcategory', 'city'])
            ->where('status', ListingStatus::Published)
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->where('category_id', $id))
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
            ->with(['category', 'subcategory', 'city'])
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public function show(string $uuid, ?User $viewer = null): Listing
    {
        $listing = Listing::query()
            ->with(['author.profile', 'category', 'subcategory', 'city'])
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
            $base = $slug;
            $i = 1;
            while (Listing::query()->where('user_id', $user->id)->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }

            return Listing::create([
                'user_id' => $user->id,
                'category_id' => $data['category_id'],
                'subcategory_id' => $data['subcategory_id'] ?? null,
                'title' => $data['title'],
                'slug' => $slug,
                'description' => $data['description'],
                'price_cents' => (int) ($data['price_cents'] ?? 0),
                'city_id' => $data['city_id'] ?? null,
                'delivery_methods' => $data['delivery_methods'] ?? [],
                'status' => ListingStatus::Draft,
            ]);
        });
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
