<?php

namespace Modules\PublicContent\Http\Controllers\Api\V1;

use App\Enums\ListingStatus;
use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Community;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;

/**
 * Адреса сущностей для sitemap.xml.
 *
 * XML собирает фронт (`frontend/src/routes/sitemap[.]xml.ts`): он знает пути
 * страниц и список статических разделов. Здесь — только то, что гость может
 * открыть, тем же отбором, что публичные списки: опубликованные объявления,
 * активные сообщества, включённые каналы.
 *
 * Профилей пользователей в карте нет намеренно: у профиля есть настройки
 * приватности, а карта сайта — приглашение поисковику. Обзоров нет: раздел
 * закрыт подпиской, гостю по ссылке покажут заглушку.
 *
 * Предел — 45 000 строк на тип: один файл sitemap вмещает 50 000 адресов.
 */
class SitemapController extends Controller
{
    private const LIMIT = 45000;

    public function __invoke(): JsonResponse
    {
        $listings = Listing::query()
            ->where('status', ListingStatus::Published)
            ->orderByDesc('updated_at')
            ->limit(self::LIMIT)
            ->get(['uuid', 'updated_at'])
            ->map(fn (Listing $l): array => ['uuid' => $l->uuid, 'lastmod' => $l->updated_at?->toDateString()]);

        $communities = Community::query()
            ->active()
            ->orderByDesc('updated_at')
            ->limit(self::LIMIT)
            ->get(['slug', 'updated_at'])
            ->map(fn (Community $c): array => ['slug' => $c->slug, 'lastmod' => $c->updated_at?->toDateString()]);

        $channels = Channel::query()
            ->where('is_active', true)
            ->orderByDesc('updated_at')
            ->limit(self::LIMIT)
            ->get(['slug', 'updated_at'])
            ->map(fn (Channel $c): array => ['slug' => $c->slug, 'lastmod' => $c->updated_at?->toDateString()]);

        return response()
            ->json(['data' => ['listings' => $listings, 'communities' => $communities, 'channels' => $channels]])
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
