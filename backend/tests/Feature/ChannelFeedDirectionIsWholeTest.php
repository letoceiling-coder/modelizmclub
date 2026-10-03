<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\CommunityCategory;
use App\Models\ListingCategory;
use App\Models\PostCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Channel\Services\ChannelPostService;
use Tests\TestCase;

/**
 * Направление «Каналы» заводится целиком или не заводится.
 *
 * Аудит 03.10: `ChannelPostService::createFeedDraft` создавал узел дерева
 * через `firstOrCreate` без `path` и `depth`. `path` объявлена nullable и без
 * значения по умолчанию — узел получался корневым по `parent_id` и
 * несуществующим по `path`. На демо-базе такая строка нашлась
 * (`#30 channels: path ПУСТО`), на боевой — нет.
 *
 * Проверка смотрит на инвариант, а не на реализацию: у корневого узла путь
 * равен слагу, глубина нулевая, и отражения в каталоге и сообществах на месте —
 * ровно то, что стоит на боевой базе (`listing_categories` 189,
 * `community_categories` 133).
 */
class ChannelFeedDirectionIsWholeTest extends TestCase
{
    use RefreshDatabase;

    public function test_первая_запись_канала_заводит_направление_с_путём_и_глубиной(): void
    {
        $this->assertNull(
            PostCategory::query()->where('slug', 'channels')->first(),
            'Предусловие: направления «Каналы» в свежей базе быть не должно.'
        );

        $владелец = User::factory()->create();
        $канал = $this->канал($владелец);

        app(ChannelPostService::class)->create($канал, $владелец, ['text' => 'Первая запись канала'], []);

        $направление = PostCategory::query()->where('slug', 'channels')->first();

        $this->assertNotNull($направление, 'Направление «Каналы» не заведено.');
        $this->assertSame('channels', $направление->path, 'У корневого узла путь обязан равняться слагу.');
        $this->assertSame(0, (int) $направление->depth);
        $this->assertNull($направление->parent_id);
    }

    public function test_отражения_в_каталоге_и_сообществах_заводятся_вместе_с_ним(): void
    {
        $владелец = User::factory()->create();
        $канал = $this->канал($владелец);

        app(ChannelPostService::class)->create($канал, $владелец, ['text' => 'Запись, заводящая направление'], []);

        foreach ([ListingCategory::class, CommunityCategory::class] as $зеркало) {
            $строка = $зеркало::query()->where('slug', 'channels')->first();

            $this->assertNotNull($строка, $зеркало.': отражение направления не заведено.');
            $this->assertSame('channels', $строка->path, $зеркало.': путь у отражения пустой.');
            $this->assertSame(0, (int) $строка->depth);
        }
    }

    public function test_вторая_запись_не_заводит_второго_узла(): void
    {
        $владелец = User::factory()->create();
        $канал = $this->канал($владелец);
        $сервис = app(ChannelPostService::class);

        $сервис->create($канал, $владелец, ['text' => 'Раз'], []);
        $сервис->create($канал, $владелец, ['text' => 'Два'], []);

        $this->assertSame(
            1,
            PostCategory::query()->where('slug', 'channels')->count(),
            'Направление должно заводиться один раз за всё время.'
        );
    }

    /**
     * Сверка дерева целиком — та же, что в `categories:normalize --check`.
     *
     * Отдельной проверкой, потому что инварианты выше смотрят на один узел, а
     * падала на боевом контуре именно сверка: она читает всё дерево и находит
     * узел, у которого пересказ (`path`, `depth`) не сходится с истиной
     * (`parent_id`).
     */
    public function test_сверка_дерева_после_заведения_узла_сходится(): void
    {
        $владелец = User::factory()->create();
        $канал = $this->канал($владелец);

        app(ChannelPostService::class)->create($канал, $владелец, ['text' => 'Запись'], []);

        $код = $this->artisan('categories:normalize', ['--check' => true]);

        $код->assertExitCode(0);
    }

    private function канал(User $владелец): Channel
    {
        return Channel::query()->create([
            'uuid' => (string) Str::uuid(),
            'owner_id' => $владелец->id,
            'name' => 'Канал '.Str::random(5),
            'slug' => 'kanal-'.Str::random(8),
            'description' => 'Описание',
        ]);
    }
}
