<?php

namespace App\Support;

use App\Enums\DeliveryCarrier;
use App\Models\Listing;
use App\Models\SellerDeliveryProfile;

/**
 * Может ли объявление быть отправлено СДЭК на самом деле.
 *
 * Предложение и возможность разошлись: на 25.09 СДЭК был указан у четырёх
 * опубликованных объявлений, и ни у одного продавца не было ни габаритов,
 * ни пункта отправки. Покупатель выбирал способ, доходил до расчёта и
 * получал отказ — честный, но после того, как он уже выбрал.
 *
 * Здесь один ответ на вопрос «возможен ли СДЭК», и его спрашивают все:
 * карточка объявления (показывать ли способ покупателю), форма правки
 * (можно ли сохранить с этим способом) и сам продавец (что доделать).
 *
 * Отдельно про «скрыть у существующих». Отдельной чистки данных не нужно:
 * способ остаётся в `delivery_methods`, но покупателю не показывается,
 * пока условия не сойдутся. Как только продавец заполнит габариты и
 * выберет пункт — СДЭК появится сам, без правки объявления.
 */
final class CdekReadiness
{
    /** Чего не хватает, словами для продавца. Пустой массив — всё на месте. */
    public const НЕТ_ГАБАРИТОВ = 'dimensions';

    public const НЕТ_ПУНКТА = 'pickup_point';

    /**
     * Доставка СДЭК по этому объявлению выполнима.
     */
    public static function ready(Listing $listing): bool
    {
        return self::missing($listing) === [];
    }

    /**
     * Что мешает. Пустой массив — ничего.
     *
     * @return list<string>
     */
    public static function missing(Listing $listing): array
    {
        if (! ParcelSize::offersCdek($listing->delivery_methods ?? [])) {
            // СДЭК не предложен — мешать нечему.
            return [];
        }

        $чего = [];

        if (! ParcelSize::measured($listing)) {
            $чего[] = self::НЕТ_ГАБАРИТОВ;
        }

        if (! self::sellerHasPoint($listing)) {
            $чего[] = self::НЕТ_ПУНКТА;
        }

        return $чего;
    }

    /** Подсказка продавцу: что именно доделать. Null — доделывать нечего. */
    public static function hint(Listing $listing): ?string
    {
        $чего = self::missing($listing);
        if ($чего === []) {
            return null;
        }

        $габариты = in_array(self::НЕТ_ГАБАРИТОВ, $чего, true);
        $пункт = in_array(self::НЕТ_ПУНКТА, $чего, true);

        if ($габариты && $пункт) {
            return 'Чтобы включить доставку СДЭК, заполните габариты и вес посылки и выберите пункт отправки в настройках доставки.';
        }

        if ($габариты) {
            return 'Чтобы включить доставку СДЭК, заполните габариты и вес посылки.';
        }

        return 'Чтобы включить доставку СДЭК, выберите пункт отправки в настройках доставки.';
    }

    /**
     * Ответ на продавца в пределах одного запроса.
     *
     * `ListingResource` отдаётся и постранично — каталог, избранное, «мои
     * объявления», — и без памятки вышел бы запрос на каждое объявление в
     * списке. Ключ — продавец, а не объявление: у одного продавца в выдаче
     * обычно несколько лотов, и ответ для них один.
     *
     * Статика живёт ровно один запрос: php-fpm поднимает процесс заново.
     * Под Octane это пришлось бы пересмотреть — там статика переживает
     * запросы, и вчерашний ответ достался бы сегодняшнему посетителю.
     *
     * @var array<int, bool>
     */
    private static array $память = [];

    /** Забыть запомненное — для проверок и для команд, меняющих профили. */
    public static function forget(): void
    {
        self::$память = [];
    }

    /**
     * Есть ли у продавца выбранный пункт отправки СДЭК.
     *
     * Открыто наружу нарочно: тем же вопросом задаётся проверка формы в
     * `ListingService::assertDeliveryDetails`. Своя копия там была бы
     * вторым ответом на один вопрос — и разошлась бы при первой же правке
     * условий, оставив форму и карточку при разных мнениях.
     */
    public static function sellerHasPoint(Listing $listing): bool
    {
        $id = (int) $listing->user_id;

        if (array_key_exists($id, self::$память)) {
            return self::$память[$id];
        }

        $profile = SellerDeliveryProfile::query()
            ->where('user_id', $id)
            ->where('provider', DeliveryCarrier::Cdek)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();

        return self::$память[$id] = $profile !== null
            && DeliveryPointSnapshot::hasPickupPoint($profile->toPointSnapshot());
    }
}
