<?php

namespace Modules\Listing\Http\Resources;

use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\User\Http\Resources\UserCompactResource;

/** @mixin Listing */
class ListingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'price_cents' => $this->price_cents,
            'currency' => $this->currency,
            'status' => $this->status->value,
            'delivery_methods' => $this->delivery_methods ?? [],
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
                ->map(fn ($item) => [
                    'uuid' => $item->media?->uuid,
                    'url' => $item->media?->url,
                    'width' => $item->media?->width,
                    'height' => $item->media?->height,
                ])
                ->filter(fn ($m) => $m['url'] !== null)
                ->values()),
            'published_at' => $this->published_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
