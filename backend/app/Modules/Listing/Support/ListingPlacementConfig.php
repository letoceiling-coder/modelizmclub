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
}
