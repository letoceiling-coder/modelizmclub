<?php

namespace App\Support;

/**
 * Снимок точки маршрута: годится он для заказа у перевозчика или только
 * для расчёта цены.
 *
 * Различие стоило девятнадцати незаведённых отправлений. СДЭК считает
 * стоимость по коду города — этого хватает, и расчёт проходил. Заказ он
 * требует либо пунктом (`shipment_point`/`delivery_point`), либо адресом
 * (`from_location`/`to_location`), и городом не довольствуется.
 *
 * Снимок вида `{"city_code":44,"label":"Москва"}` непустой и на вид
 * готовый. Проверка `!== null` его пропускала, и дальше он молча ехал
 * в заказ, где СДЭК отвечал `[shipment_point] is empty`. Поэтому вопрос
 * к снимку — не «есть ли он», а «что в нём есть».
 */
final class DeliveryPointSnapshot
{
    /**
     * Пункт выбран: заказ с таким снимком СДЭК примет.
     *
     * @param  array<string, mixed>|null  $snapshot
     */
    public static function hasPickupPoint(?array $snapshot): bool
    {
        if ($snapshot === null) {
            return false;
        }

        return trim((string) ($snapshot['external_point_id'] ?? '')) !== '';
    }

    /**
     * Адрес известен — этого хватает для тарифов «от двери».
     *
     * @param  array<string, mixed>|null  $snapshot
     */
    public static function hasAddress(?array $snapshot): bool
    {
        if ($snapshot === null) {
            return false;
        }

        $address = $snapshot['address'] ?? null;

        if (is_array($address)) {
            $address = $address['address'] ?? $address['full_address'] ?? null;
        }

        return trim((string) ($address ?? '')) !== '';
    }

    /**
     * Город есть, а пункта нет: хватит на расчёт, не хватит на заказ.
     *
     * @param  array<string, mixed>|null  $snapshot
     */
    public static function cityOnly(?array $snapshot): bool
    {
        if ($snapshot === null) {
            return false;
        }

        if (self::hasPickupPoint($snapshot) || self::hasAddress($snapshot)) {
            return false;
        }

        return (int) ($snapshot['city_code'] ?? 0) > 0;
    }
}
