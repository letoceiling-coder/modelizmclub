<?php

namespace Modules\Listing\Support;

use App\Models\SystemSetting;

final class ListingPlacementConfig
{
    public static function paymentEnabled(): bool
    {
        $value = SystemSetting::query()
            ->where('key', 'feature.listing_payment_enabled')
            ->value('value');

        return (bool) ($value['enabled'] ?? false);
    }

    /** @deprecated Use registeredPriceCents(); kept for backward compatibility. */
    public static function defaultPriceCents(): int
    {
        return self::registeredPriceCents();
    }

    public static function registeredPriceCents(): int
    {
        return self::priceFromSetting('listing.placement.registered_price_cents', 2000);
    }

    public static function guestPriceCents(): int
    {
        return self::priceFromSetting('listing.placement.guest_price_cents', 3000);
    }

    /** Preferential listing price for active subscribers. Falls back to 20 ₽. */
    public static function subscriberDefaultPriceCents(): int
    {
        return self::priceFromSetting('listing.placement.subscriber_default_price_cents', 2000);
    }

    private static function priceFromSetting(string $key, int $fallback): int
    {
        $value = SystemSetting::query()->where('key', $key)->value('value');

        if (is_array($value) && array_key_exists('cents', $value) && $value['cents'] !== null) {
            return max(0, (int) $value['cents']);
        }

        // Legacy single default key.
        if ($key === 'listing.placement.registered_price_cents') {
            $legacy = SystemSetting::query()
                ->where('key', 'listing.placement.default_price_cents')
                ->value('value');
            if (is_array($legacy) && isset($legacy['cents'])) {
                return max(0, (int) $legacy['cents']);
            }
        }

        return $fallback;
    }
}
