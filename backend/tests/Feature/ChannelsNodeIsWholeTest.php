<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use App\Enums\UserStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Catalog\Services\CatalogService;
use Modules\Channel\Services\ChannelPostService;
use Tests\TestCase;

/**
 * Служебный раздел «Каналы» заводится целиком.
 *
 * `ChannelPostService` заводил его через `firstOrCreate` с именем, флагом
 * активности и порядком — и всё. Узел получался наполовину: `depth`
 * оставался нулём по умолчанию колонки, `path` — NULL, а три флага показа
 * брали своё умолчание `true`.
 *
 * Чем это кончилось, видно на проде 03.10: узел 223 выправили позже, но
 * флаги остались, и по ним завелись зеркала. «Каналы» — корневой раздел во
 * всех трёх публичных деревьях, включая каталог объявлений и сообщества:
 * служебный раздел ленты предлагается человеку как категория объявления.
 *
 * `path` — не украшение: по нему идёт отбор потомков (`path like 'a/b/%'`),
 * и NULL там означает «потомков нет никогда».
 */
class ChannelsNodeIsWholeTest extends TestCase
{
    use RefreshDatabase;

    private function каналСВладельцем(): array
    {
        $owner = User::factory()->create(['status' => UserStatus::Active, 'email_verified_at' => now()]);
        $channel = Channel::query()->create([
            'owner_id' => $owner->id,
            'name' => 'Канал для проверки',
            'slug' => 'kanal-'.uniqid(),
            'status' => 'active',
        ]);

        return [$channel, $owner];
    }

    /**
     * Раздел заводится настоящим действием — записью в канал.
     *
     * Не вызовом метода через отражение: проверять надо тот путь, по
     * которому узел появляется у людей, иначе проверка останется зелёной
     * при переставшем вызываться заведении.
     */
    private function завестиРаздел(): PostCategory
    {
        [$channel, $owner] = $this->каналСВладельцем();

        app(ChannelPostService::class)->create(
            $channel,
            $owner,
            ['text' => 'Запись канала для проверки раздела', 'kind' => 'news'],
            [],
        );

        $раздел = PostCategory::query()->where('slug', 'channels')->first();
        $this->assertNotNull($раздел, 'запись канала не завела служебный раздел');

        return $раздел;
    }

    public function test_узел_получает_место_в_дереве(): void
    {
        $this->assertSame(0, PostCategory::query()->where('slug', 'channels')->count());

        $раздел = $this->завестиРаздел();

        // Суть дефекта: `path` оставался NULL, и отбор потомков по нему
        // не нашёл бы ничего никогда.
        $this->assertSame('channels', $раздел->path, 'путь узла не заполнен');
        $this->assertSame(0, (int) $раздел->depth);
    }

    public function test_служебный_раздел_не_уезжает_в_каталог_и_сообщества(): void
    {
        $раздел = $this->завестиРаздел();

        $this->assertTrue($раздел->in_feed, 'раздел должен быть виден в ленте');
        $this->assertFalse($раздел->in_listings, 'служебный раздел ленты попал в каталог объявлений');
        $this->assertFalse($раздел->in_communities, 'служебный раздел ленты попал в сообщества');

        // И зеркал нет: по флагам их не должно появиться.
        $this->assertFalse(
            ListingCategory::query()->where('slug', 'channels')->exists(),
            'зеркало в каталоге объявлений завелось',
        );
        $this->assertFalse(
            CommunityCategory::query()->where('slug', 'channels')->exists(),
            'зеркало в сообществах завелось',
        );
    }

    public function test_существующий_узел_не_переписывается(): void
    {
        // Флаги и место в дереве существующего узла — решение администратора.
        $свой = PostCategory::query()->create([
            'slug' => 'channels',
            'name' => 'Каналы',
            'is_active' => true,
            'sort_order' => 1,
            'in_feed' => true,
            'in_listings' => true,
            'in_communities' => false,
            'depth' => 0,
            'path' => 'channels',
            'listing_category_id' => null,
        ]);

        $раздел = $this->завестиРаздел();

        $this->assertSame($свой->id, $раздел->id);
        $this->assertTrue($раздел->in_listings, 'настройку администратора переписали');
        $this->assertSame(1, (int) $раздел->sort_order);

        /*
         * Главное утверждение этой проверки — здесь, и до ревью его не было.
         *
         * Три предыдущих остаются зелёными, даже если убрать защиту
         * `wasRecentlyCreated` и звать разведение всегда: `applyHierarchy`
         * пересчитает узлу те же `depth` и `path`, а `mirror()` переписывает
         * поля зеркала, но флаги и порядок самого `PostCategory` не трогает.
         * То есть проверка называлась «существующий узел не переписывается»
         * и ничего об этом не проверяла.
         *
         * Отличает два поведения связь с зеркалом: при `in_listings = true`
         * разведение заведёт `ListingCategory` и проставит
         * `listing_category_id`. Этого при существующем узле быть не должно
         * — его зеркала заводит администратор, а не запись в канал.
         */
        $this->assertNull(
            $раздел->listing_category_id,
            'существующему узлу завели зеркало — значит разведение позвали, когда не должны были',
        );
        $this->assertFalse(
            ListingCategory::query()->where('slug', 'channels')->exists(),
            'зеркало в каталоге объявлений завелось для существующего узла',
        );
    }
    /**
     * Новый раздел доезжает до дерева справочников.
     *
     * Кеш греется до записи, читается после — так же это увидит человек.
     *
     * Названо по тому, что проверяется. Сброса кеша **после коммита** эта
     * проверка не доказывает: под `RefreshDatabase` транзакция не
     * коммитится, `afterCommit` не срабатывает, а внутренний сброс уже
     * случился и дерево пересобирается свежим в обоих случаях. Проверено
     * откатом — без `DB::afterCommit` проверка остаётся зелёной. Гонку двух
     * запросов здесь воспроизвести нечем, и делать вид, что покрыта, нельзя.
     */
    public function test_новый_раздел_доезжает_до_дерева(): void
    {
        $дерево = app(CatalogService::class);

        // Греем кеш до того, как раздел появится.
        $было = $дерево->postCategoryTree();
        $this->assertFalse(
            $this->естьВДереве($было, 'channels'),
            'раздел уже в дереве — греть было нечего',
        );

        $this->завестиРаздел();

        $стало = app(CatalogService::class)->postCategoryTree();
        $this->assertTrue(
            $this->естьВДереве($стало, 'channels'),
            'дерево осталось прежним: новый узел до справочника не доехал',
        );
    }

    /** @param array<int, mixed> $узлы */
    private function естьВДереве(array $узлы, string $slug): bool
    {
        foreach ($узлы as $узел) {
            $свой = is_array($узел) ? ($узел['slug'] ?? null) : ($узел->slug ?? null);
            if ($свой === $slug) {
                return true;
            }
            $дети = is_array($узел) ? ($узел['children'] ?? []) : ($узел->children ?? []);
            if (is_iterable($дети) && $this->естьВДереве(is_array($дети) ? $дети : iterator_to_array($дети), $slug)) {
                return true;
            }
        }

        return false;
    }

}
