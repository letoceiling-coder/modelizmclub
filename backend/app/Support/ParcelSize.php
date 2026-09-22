<?php

namespace App\Support;

use App\Models\Listing;

/**
 * Посылка объявления: что едет и сколько весит.
 *
 * До 22.09 габариты можно было не указывать — вместо них выбирался
 * типоразмер S/M/L, за которым стояла придуманная коробка (M — 30×20×15 см,
 * 2 кг). Тариф считался по ней, а в пункт приёма приезжала настоящая, и
 * разницу доплачивала площадка.
 *
 * Решение убрать типоразмеры — продолжение поправки 07.09, а не разворот.
 * Тогда выяснилось, что приоритет был обратным: пресет перекрывал введённые
 * габариты, и они не доезжали до базы. На проде из семи объявлений с
 * типоразмером у всех семи габариты совпадали с пресетом до сантиметра, а
 * объявлений со своими габаритами не было ни одного — ни один продавец не
 * смог сохранить измеренное. Приоритет тогда развернули; теперь у пресета
 * отобрана и последняя роль.
 */
final class ParcelSize
{
    public static function offersCdek(?array $methods): bool
    {
        foreach ($methods ?? [] as $method) {
            $value = mb_strtolower(trim((string) $method));
            if ($value === 'cdek' || str_contains($value, 'сдэк') || str_contains($value, 'cdek')) {
                return true;
            }
        }

        return false;
    }

    public static function offersPickup(?array $methods): bool
    {
        foreach ($methods ?? [] as $method) {
            $value = mb_strtolower(trim((string) $method));
            if (str_contains($value, 'самовывоз') || $value === 'pickup') {
                return true;
            }
        }

        return false;
    }

    /**
     * Привести габариты и вес к виду, в котором их принимает расчёт.
     *
     * Ничего не домысливает: что продавец измерил, то и едет в тариф.
     * Отсутствующее значение не заменяется догадкой — форма такого не
     * пропускает (`ListingService::assertDeliveryDetails`), а старым строкам
     * и импорту оставлен пол в единицу, чтобы расчёт не падал делением на
     * ноль там, где исправить данные уже некому.
     *
     * @param  array<string, mixed>|null  $dimensions
     * @return array{dimensions_cm: array{length: int, width: int, height: int}, weight_kg: float}
     */
    public static function resolve(?array $dimensions, mixed $weightKg): array
    {
        return [
            'dimensions_cm' => [
                'length' => max(1, (int) ($dimensions['length'] ?? 0)),
                'width' => max(1, (int) ($dimensions['width'] ?? 0)),
                'height' => max(1, (int) ($dimensions['height'] ?? 0)),
            ],
            'weight_kg' => max(0.01, (float) $weightKg),
        ];
    }

    /**
     * @return array{dimensions_cm: array{length: int, width: int, height: int}, weight_kg: float}
     */
    public static function fromListing(Listing $listing): array
    {
        return self::resolve(
            is_array($listing->dimensions_cm) ? $listing->dimensions_cm : null,
            $listing->weight_kg,
        );
    }
}
