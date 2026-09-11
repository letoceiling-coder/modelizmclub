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
use Illuminate\Support\Facades\Cache;
use Modules\Catalog\Services\CatalogService;

class PublicBootstrapService
{
    public function __construct(
        private readonly LandingBlocksService $landingBlocks,
        private readonly FeedGuestAccessService $guestAccess,
        private readonly CatalogService $catalog,
    ) {}

    /**
     * Ключ в Redis. Номер в конце — чтобы смена формы ответа при выкатке не
     * отдала старую форму из кеша: поменял структуру — поменяй номер.
     */
    public const CACHE_KEY = 'public.bootstrap.v1';

    /**
     * Сколько держать. Столько же, сколько уже обещано клиентам: контроллер
     * отдаёт `max-age=15`, и Nitro держит ответ в памяти процесса те же
     * 15 секунд (BOOTSTRAP_TTL_MS во фронтенде).
     */
    public const CACHE_TTL = 15;

    /**
     * Ответ целиком, из Redis.
     *
     * Сборка стоит ~19 мс и 29 запросов к базе — замер на проде 11.09. В
     * аудите стояло «55–64 мс и −50 мс на SSR каждой страницы», и обе цифры
     * неверны: 55–64 — это весь HTTP-ответ с TLS и FPM (пустой /health
     * стоит ~27 мс), а SSR и так берёт bootstrap раз в 15 секунд из памяти
     * процесса. Выигрыш — 29 запросов к базе на каждом обращении к PHP, а не
     * время первого экрана.
     *
     * Без сброса Redis добавил бы к 15 с Nitro и 15 с браузера ещё 15 с
     * устаревания после сохранения в админке. Поэтому кеш сбрасывается при
     * любой записи в данные, из которых он собран, — см. forget() и его
     * вызовы. Счётчики (пользователи, первая сотня) меняются сами по себе и
     * устаревают не дольше TTL.
     *
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, fn (): array => $this->build());
    }

    /**
     * Сбросить кеш. Вызывается из событий моделей, из которых собирается
     * ответ (AppServiceProvider), из CatalogService::flushCache() и явно из
     * трёх перестановок порядка в админке — они пишут массовым `update()`,
     * мимо событий модели.
     */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** @return array<string, mixed> */
    private function build(): array
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
            'post_categories' => $this->catalog->postCategoryTree(),
            'listing_categories' => $this->catalog->listingCategoryTree(),
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
