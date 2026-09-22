<?php

namespace Modules\Billing\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Billing\Services\SafeDealService;

class QuoteSafeDealController extends Controller
{
    public function __invoke(Request $request, string $uuid, SafeDealService $deals): JsonResponse
    {
        $listing = Listing::query()->with(['city', 'author'])->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'delivery_method' => ['nullable', 'string', 'max:120'],
            'destination_point' => ['nullable', 'array'],
            'destination_point.city_code' => ['required_with:destination_point', 'integer', 'min:1'],
            'destination_point.external_point_id' => ['nullable', 'string', 'max:64'],
            'destination_point.name' => ['nullable', 'string', 'max:255'],
            'destination_point.address' => ['nullable', 'string', 'max:500'],
            'destination_point.latitude' => ['nullable', 'numeric'],
            'destination_point.longitude' => ['nullable', 'numeric'],
        ]);

        $quote = $deals->quoteForListing(
            $listing,
            $data['destination_point'] ?? [],
            $data['delivery_method'] ?? null,
        );

        /*
         * Надбавка площадки покупателю не показывается: он видит одну строку
         * «Доставка» с итогом. Разбивка «тариф перевозчика + надбавка» ему
         * ничего не даёт — торговаться с перевозчиком он не может, — а
         * площадке она нужна, и лежит в `metadata` сделки.
         *
         * Вычёркивается здесь, у самой границы наружу: внутри расчёта строка
         * нужна, чтобы доехать до сделки.
         */
        unset($quote['delivery_markup_kopecks']);

        return response()->json(['data' => $quote]);
    }
}
