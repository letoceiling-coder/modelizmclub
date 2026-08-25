<?php

namespace Modules\PublicContent\Services;

use App\Enums\CommunityStatus;
use App\Models\Community;
use App\Models\FaqCategory;
use App\Models\FooterLink;
use App\Models\ListingCategory;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\FeatureFlags;
use App\Support\FirstHundredPromo;
use App\Support\FooterContacts;
use App\Support\ReferralProgramConfig;
use App\Support\SiteBranding;

class PublicBootstrapService
{
    public function __construct(
        private readonly LandingBlocksService $landingBlocks,
        private readonly FeedGuestAccessService $guestAccess,
    ) {}

    /** @return array<string, mixed> */
    public function payload(): array
    {
        $brandingRaw = SystemSetting::query()
            ->where('key', SiteBranding::SETTING_KEY)
            ->value('value');
        $contactsRaw = SystemSetting::query()
            ->where('key', FooterContacts::SETTING_KEY)
            ->value('value');
        $iconRaw = SystemSetting::query()->where('key', 'icon_overrides')->first()?->value;
        $stats = FirstHundredPromo::publicStats();
        $referral = ReferralProgramConfig::get();

        return [
            'feature_flags' => [
                'communities_enabled' => FeatureFlags::enabled('feature.communities_enabled'),
                'reviews_enabled' => FeatureFlags::enabled('feature.reviews_enabled', true),
                'market_enabled' => FeatureFlags::enabled('feature.market_enabled'),
                'escrow_enabled' => FeatureFlags::enabled('feature.escrow_enabled'),
                'listing_payment_enabled' => FeatureFlags::enabled('feature.listing_payment_enabled'),
            ],
            'branding' => SiteBranding::publicPayload(is_array($brandingRaw) ? $brandingRaw : null),
            'footer_contacts' => FooterContacts::publicPayload(is_array($contactsRaw) ? $contactsRaw : null),
            'footer_links' => $this->footerLinks(),
            'landing_blocks' => $this->landingBlocks->publicPayload(),
            'landing_stats' => [
                'users' => User::query()->count(),
                'communities' => Community::query()->where('status', CommunityStatus::Active)->count(),
                'listing_categories' => ListingCategory::query()
                    ->whereNull('parent_id')
                    ->where('is_active', true)
                    ->count(),
            ],
            'stats' => [
                'first_hundred' => [
                    'taken' => $stats['taken'],
                    'total' => $stats['total'],
                    'enabled' => $stats['enabled'],
                ],
                'referral' => [
                    'enabled' => $referral['enabled'],
                    'per_invite' => $referral['per_invite'],
                    'max_bonus' => $referral['max_bonus'],
                ],
            ],
            'feed_guest_access' => $this->guestAccess->publicPayload(),
            'icon_overrides' => is_array($iconRaw) && $iconRaw !== [] ? $iconRaw : new \stdClass(),
            'landing_faq' => $this->landingFaq(),
        ];
    }

    /** @return array<string, mixed> */
    private function footerLinks(): array
    {
        $links = FooterLink::query()
            ->where('is_visible', true)
            ->orderBy('group')
            ->orderBy('sort')
            ->get();

        return $links->groupBy('group')->map(
            fn ($items) => $items->map(fn (FooterLink $link) => [
                'id' => $link->id,
                'label' => $link->label,
                'target_type' => $link->target_type,
                'target_value' => $link->target_value,
                'sort' => $link->sort,
            ])->values()
        )->all() ?: new \stdClass();
    }

    /** @return list<array<string, mixed>> */
    private function landingFaq(): array
    {
        return FaqCategory::query()
            ->where('is_active', true)
            ->where('slug', 'landing')
            ->with(['articles' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get()
            ->map(fn (FaqCategory $c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'articles' => $c->articles->map(fn ($a) => [
                    'id' => $a->id,
                    'question' => $a->question,
                    'answer' => $a->answer,
                ]),
            ])
            ->all();
    }
}
