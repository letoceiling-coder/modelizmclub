<?php

namespace Modules\Chat\Http\Resources;

use App\Models\Listing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Listing */
class ListingCompactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $preview = null;
        if ($this->relationLoaded('mediaItems')) {
            $media = $this->mediaItems->first()?->media;
            $variants = $media?->publicVariantUrls() ?? [];
            $preview = $variants['card']['webp']
                ?? $variants['card']['jpeg']
                ?? $variants['thumb']['webp']
                ?? $variants['thumb']['jpeg']
                ?? $media?->url;
        }

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'title' => $this->title,
            'price_cents' => $this->price_cents,
            'currency' => $this->currency,
            'image' => $preview,
            'preview' => $preview,
        ];
    }
}
