<?php

namespace Modules\Catalog\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class AddressSuggestService
{
    /**
     * @return list<array{label: string}>
     */
    public function suggest(string $query, ?string $city = null): array
    {
        $query = trim($query);
        $city = $city !== null ? trim($city) : '';
        if (mb_strlen($query) < 3) {
            return [];
        }
        if (mb_strlen($query) > 200) {
            $query = mb_substr($query, 0, 200);
        }
        if (mb_strlen($city) > 80) {
            $city = mb_substr($city, 0, 80);
        }

        $typedCity = null;
        if (str_contains($query, ',')) {
            $head = trim(explode(',', $query, 2)[0]);
            if (mb_strlen($head) >= 2) {
                $typedCity = $head;
            }
        }

        $biasCity = $typedCity ?: ($city !== '' ? $city : null);
        $search = $query;
        if ($city !== '' && $typedCity === null && ! str_contains(mb_strtolower($query), mb_strtolower($city))) {
            $search = $city.', '.$query;
        }

        $cacheKey = 'geo:addr:v2:'.md5(mb_strtolower($search).'|'.mb_strtolower((string) $biasCity));

        return Cache::remember($cacheKey, now()->addHours(6), function () use ($search, $biasCity): array {
            return $this->lookupNominatim($search, $biasCity);
        });
    }

    /**
     * @return list<array{label: string}>
     */
    private function lookupNominatim(string $search, ?string $biasCity): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'ModelizmClub/1.0 (https://modelizmclub.ru; geo-suggest)',
                'Accept-Language' => 'ru',
            ])
                ->timeout(5)
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $search,
                    'format' => 'jsonv2',
                    'limit' => 10,
                    'addressdetails' => 1,
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
        $seen = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $label = $this->formatLabel($item, $biasCity);
            if ($label === null) {
                continue;
            }
            $key = mb_strtolower($label);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = ['label' => $label];
            if (count($out) >= 8) {
                break;
            }
        }

        return $out;
    }

    /**
     * Compact “city, street[, house]” instead of the full OSM display_name dump.
     *
     * @param  array<string, mixed>  $item
     */
    public function formatLabel(array $item, ?string $biasCity): ?string
    {
        $type = (string) ($item['addresstype'] ?? $item['type'] ?? '');
        if (in_array($type, ['country', 'state', 'region', 'county', 'postcode', 'continent'], true)) {
            return null;
        }

        $address = is_array($item['address'] ?? null) ? $item['address'] : [];
        $city = trim((string) ($address['city'] ?? $address['town'] ?? $address['village'] ?? ''));
        $road = trim((string) ($address['road'] ?? $address['pedestrian'] ?? $address['street'] ?? ''));
        $house = trim((string) ($address['house_number'] ?? ''));
        $name = trim((string) ($item['name'] ?? ''));

        if ($road === '' && in_array($type, ['road', 'residential', 'pedestrian', 'living_street'], true) && $name !== '') {
            $road = $name;
        }
        if ($road === '' && $type === 'house' && $name !== '' && ! preg_match('/^\d/', $name)) {
            $road = $name;
        }

        if ($biasCity !== null && $biasCity !== '') {
            $hay = mb_strtolower($city.' '.(string) ($address['municipality'] ?? '').' '.(string) ($address['county'] ?? ''));
            if ($city !== '' && ! str_contains($hay, mb_strtolower($biasCity))) {
                return null;
            }
            if ($city === '' && in_array($type, ['hamlet', 'isolated_dwelling', 'neighbourhood'], true)) {
                return null;
            }
        }

        if (in_array($type, ['hamlet', 'isolated_dwelling'], true) && $road === '') {
            return null;
        }

        if ($road === '') {
            return null;
        }

        $cityLabel = $city !== '' ? $city : $biasCity;
        if ($cityLabel === null || $cityLabel === '') {
            return null;
        }

        $parts = [$cityLabel, $road];
        if ($house !== '') {
            $parts[] = $house;
        }

        return implode(', ', $parts);
    }
}
