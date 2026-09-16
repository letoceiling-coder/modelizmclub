<?php

namespace Modules\Listing\Http\Resources;

use App\Models\Listing;
use App\Http\Resources\Concerns\HasCanFlags;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Listing\Services\ListingBoostService;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Listing */
class ListingResource extends JsonResource
{
    use HasCanFlags;

    public function toArray(Request $request): array
    {
        $boost = app(ListingBoostService::class);
        $promotedUntil = $boost->promotedUntil($this->resource);

        return [
            'uuid' => $this->uuid,
            'can' => $this->canFlags($request->user(), ['edit' => 'update', 'delete', 'restore', 'promote']),
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'price_cents' => $this->price_cents,
            'condition' => $this->condition?->value,
            'currency' => $this->currency,
            'status' => $this->status->value,
            'delivery_methods' => $this->delivery_methods ?? [],
            'package_size' => $this->package_size,
            'weight_kg' => $this->weight_kg,
            'dimensions_cm' => $this->dimensions_cm,
            'pickup_address' => $this->pickup_address,
            'offers_cdek' => \App\Support\ParcelSize::offersCdek($this->delivery_methods ?? []),
            'contact_via_messenger' => $this->contact_via_messenger,
            'views_count' => $this->views_count,
            'favorites_count' => $this->favorites_count,
            'author' => new UserCompactResource($this->whenLoaded('author')),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'subcategory' => $this->whenLoaded('subcategory', fn () => $this->subcategory ? [
                'id' => $this->subcategory->id,
                'name' => $this->subcategory->name,
                'slug' => $this->subcategory->slug,
            ] : null),
            'city' => $this->whenLoaded('city', fn () => $this->city ? [
                'id' => $this->city->id,
                'name' => $this->city->name,
            ] : null),
            'media' => $this->whenLoaded('mediaItems', fn () => $this->mediaItems
                ->map(fn ($item) => $item->media?->toApiArray())
                ->filter()
                ->values()),
            /*
             * Почему черновик не опубликовался, видно в самом объявлении.
             * Мастер создаёт черновик до оплаты; человек уходит с формы банка —
             * и черновик остаётся без объяснений (приёмка 16.09). Показываем
             * состояние оплаты владельцу, остальным это знать незачем.
             */
            'placement' => $this->when(
                $request->user() !== null && (int) $request->user()->id === (int) $this->user_id,
                fn () => [
                    'was_free' => (bool) $this->placement_was_free,
                    'amount_cents' => $this->placement_amount_cents,
                    'payment_status' => $this->placement_payment_id
                        ? ($this->relationLoaded('placementPayment')
                            ? $this->placementPayment?->status
                            : \App\Models\Payment::query()->whereKey($this->placement_payment_id)->value('status'))
                        : null,
                    'paid' => $this->placement_payment_id
                        ? ($this->relationLoaded('placementPayment')
                            ? $this->placementPayment?->status === 'paid'
                            : \App\Models\Payment::query()->whereKey($this->placement_payment_id)->where('status', 'paid')->exists())
                        : (bool) $this->placement_was_free,
                ],
            ),
            'published_at' => $this->published_at?->toIso8601String(),
            'is_reserved' => $this->reserved_at !== null,
            'rejection_reason' => $this->rejection_reason,
            'deleted_at' => $this->deleted_at?->toIso8601String(),
            'is_promoted' => $promotedUntil !== null,
            'promoted_until' => $promotedUntil?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
