<?php

namespace Modules\Listing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Listing\Http\Resources\ListingResource;
use Modules\Listing\Services\ListingService;

class IndexListingsController extends Controller
{
    public function __invoke(Request $request, ListingService $listings): JsonResponse
    {
        $filters = [
            'category_id' => $request->integer('category_id') ?: null,
            'subcategory_id' => $request->integer('subcategory_id') ?: null,
            'city_id' => $request->integer('city_id') ?: null,
            'category_ids' => $request->filled('category_ids') ? array_filter(array_map('intval', (array) $request->input('category_ids'))) : null,
            'q' => $request->string('q')->toString() ?: null,
            'delivery_method' => $request->string('delivery_method')->toString() ?: null,
            'sort' => $request->string('sort')->toString() ?: 'newest',
        ];

        if ($request->filled('price_min')) {
            $filters['price_min'] = $request->float('price_min');
        }
        if ($request->filled('price_max')) {
            $filters['price_max'] = $request->float('price_max');
        }
        if ($request->has('has_media')) {
            $filters['has_media'] = $request->boolean('has_media');
        }

        $paginator = $listings->list($filters, min($request->integer('per_page', 20), 50));

        return ListingResource::collection($paginator)
            ->additional(['meta' => ['sort' => $filters['sort']]])
            ->response();
    }
}
