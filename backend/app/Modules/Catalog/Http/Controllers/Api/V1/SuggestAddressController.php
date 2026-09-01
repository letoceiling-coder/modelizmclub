<?php

namespace Modules\Catalog\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SuggestAddressController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim((string) $request->string('q'));
        if (mb_strlen($query) < 3) {
            return response()->json(['data' => []]);
        }
        if (mb_strlen($query) > 200) {
            $query = mb_substr($query, 0, 200);
        }

        $cacheKey = 'geo:addr:'.md5(mb_strtolower($query));
        $rows = Cache::remember($cacheKey, now()->addHours(6), function () use ($query): array {
            try {
                $response = Http::withHeaders([
                    'User-Agent' => 'ModelizmClub/1.0 (https://modelizmclub.ru; geo-suggest)',
                    'Accept-Language' => 'ru',
                ])
                    ->timeout(5)
                    ->get('https://nominatim.openstreetmap.org/search', [
                        'q' => $query,
                        'format' => 'jsonv2',
                        'limit' => 6,
                        'addressdetails' => 0,
                        'countrycodes' => 'ru',
                    ]);
            } catch (\Throwable) {
                return [];
            }

            if (! $response->successful()) {
                return [];
            }

            $items = $response->json();
            if (! is_array($items)) {
                return [];
            }

            $out = [];
            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $label = trim((string) ($item['display_name'] ?? ''));
                if ($label === '') {
                    continue;
                }
                $out[] = ['label' => $label];
            }

            return $out;
        });

        return response()->json(['data' => $rows]);
    }
}
