<?php

namespace Tests\Feature;

use App\Models\CommunityCategory;
use App\Models\LegalPage;
use App\Models\PostCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Два блокера приёмки 29.09.
 *
 * Оба про расхождение того, что система делает, с тем, что она про себя
 * говорит или показывает. Проверки построены так, чтобы уметь отвечать
 * «нет»: сперва воспроизводится прежнее состояние, потом применяется
 * починка, потом сверяется результат.
 */
class AcceptanceBlockersTest extends TestCase
{
    use RefreshDatabase;

    // ------------------------------------------------------------------
    // 1. Правила безопасной сделки
    // ------------------------------------------------------------------

    public function test_the_safe_deal_rules_no_longer_say_the_seller_pays(): void
    {
        $html = (string) LegalPage::query()->where('slug', 'safe-deal')->value('content_html');

        $this->assertNotSame('', $html, 'Страницы «Правила безопасной сделки» нет — проверять нечего.');

        foreach ([
            'удерживается из выплаты Продавцу',
            'за вычетом комиссии',
            'не добавляется сверху к холду Покупателя',
            'стоимость товара − комиссия платформы',
        ] as $старое) {
            $this->assertStringNotContainsString(
                $старое,
                $html,
                "В правилах осталась прежняя схема: «{$старое}».",
            );
        }
    }

    public function test_the_safe_deal_rules_state_the_new_order_explicitly(): void
    {
        // Недостаточно убрать старое — надо, чтобы новое было сказано.
        $html = (string) LegalPage::query()->where('slug', 'safe-deal')->value('content_html');

        foreach ([
            'комиссия платформы + стоимость доставки',
            'оплачивается Покупателем сверх неё',
            'без вычетов',
            'включая комиссию',
            'При разделении суммы в споре комиссия также возвращается Покупателю полностью',
        ] as $новое) {
            $this->assertStringContainsString($новое, $html, "В правилах не сказано: «{$новое}».");
        }
    }

    public function test_the_rules_page_stays_published_and_gains_a_revision(): void
    {
        /*
         * Правка через админку переводит страницу в черновик, и она
         * пропадает с сайта. Для правил безопасной сделки это было бы
         * хуже устаревшего текста.
         */
        $this->getJson('/api/v1/legal/safe-deal')
            ->assertOk()
            ->assertJsonPath('data.slug', 'safe-deal');

        $page = LegalPage::query()->where('slug', 'safe-deal')->firstOrFail();

        $this->assertGreaterThan(1, (int) $page->version, 'Версия не выросла — правка не записана как новая редакция.');
        $this->assertTrue(
            $page->revisions()->exists(),
            'Прежняя редакция не сохранена: откатить правку из админки будет нечем.',
        );
    }

    // ------------------------------------------------------------------
    // 2. Осиротевшие направления
    // ------------------------------------------------------------------

    public function test_no_direction_is_left_without_the_parent_its_path_names(): void
    {
        $сироты = PostCategory::query()
            ->whereNull('parent_id')
            ->where('depth', '>', 0)
            ->pluck('slug')
            ->all();

        $this->assertSame([], $сироты, 'Есть узлы с глубиной без родителя: '.implode(', ', $сироты));
    }

    public function test_depth_and_path_agree_with_parent_id(): void
    {
        // Та же сверка, что делает `category-tree-drift.sh` на проде.
        // На чистой базе категорий нет — заводим ветку, иначе проверка
        // прошла бы, ничего не проверив.
        $корень = PostCategory::query()->create([
            'name' => 'Корень', 'slug' => 'zzz-root', 'is_active' => true, 'depth' => 0, 'path' => 'zzz-root',
        ]);
        PostCategory::query()->create([
            'parent_id' => $корень->id,
            'name' => 'Ветка', 'slug' => 'zzz-branch', 'is_active' => true, 'depth' => 1,
            'path' => 'zzz-root/zzz-branch',
        ]);

        foreach (PostCategory::query()->get() as $узел) {
            $цепочка = [];
            $текущий = $узел;
            $видели = [];
            while ($текущий->parent_id !== null && ! isset($видели[$текущий->id])) {
                $видели[$текущий->id] = true;
                $текущий = PostCategory::query()->find($текущий->parent_id);
                if (! $текущий) {
                    $this->fail("У «{$узел->slug}» родителя нет в базе.");
                }
                array_unshift($цепочка, $текущий->slug);
            }

            $this->assertSame(count($цепочка), (int) $узел->depth, "Глубина «{$узел->slug}» не совпала с цепочкой.");
            $this->assertSame(
                implode('/', [...$цепочка, $узел->slug]),
                (string) $узел->path,
                "Путь «{$узел->slug}» не совпал с цепочкой родителей.",
            );
        }
    }

    public function test_a_restored_parent_takes_its_name_from_the_mirror_and_not_from_thin_air(): void
    {
        /*
         * Воспроизводим прежнее состояние: узел с путём «родитель/ребёнок»,
         * но без родителя. На чистой базе сирот нет, поэтому ломаем
         * нарочно — иначе проверка доказывала бы только то, что пустое
         * дерево непротиворечиво.
         */
        $образец = CommunityCategory::query()->create([
            'name' => 'Проверочный родитель',
            'slug' => 'zzz-probe-parent',
            'sort_order' => 0,
            'is_active' => true,
            'depth' => 0,
            'path' => 'zzz-probe-parent',
        ]);

        $сирота = PostCategory::query()->create([
            'parent_id' => null,
            'name' => 'Проверочный ребёнок',
            'slug' => 'zzz-probe-child',
            'is_active' => true,
            'in_feed' => true,
            'in_listings' => false,
            'in_communities' => false,
            'depth' => 1,
            'path' => 'zzz-probe-parent/zzz-probe-child',
        ]);

        // Контроль: до починки он действительно сирота.
        $this->assertSame(
            1,
            PostCategory::query()->whereNull('parent_id')->where('depth', '>', 0)->count(),
            'Не удалось воспроизвести прежнее состояние — проверка ничего не докажет.',
        );

        $this->починить();

        $восстановленный = PostCategory::query()->where('slug', 'zzz-probe-parent')->first();

        $this->assertNotNull($восстановленный, 'Родитель не восстановлен.');
        $this->assertSame($образец->name, $восстановленный->name, 'Название родителя взято не из зеркала.');
        $this->assertSame((int) $восстановленный->id, (int) $сирота->fresh()->parent_id);
        // Флаги родителя — объединение детских: иначе ребёнок пропал бы из ленты.
        $this->assertTrue((bool) $восстановленный->in_feed);
        // И дерево стало деревом: ребёнок больше не корень.
        $this->assertSame(0, PostCategory::query()->whereNull('parent_id')->where('depth', '>', 0)->count());
        $this->assertSame(1, (int) $сирота->fresh()->depth);
        $this->assertSame('zzz-probe-parent/zzz-probe-child', (string) $сирота->fresh()->path);
    }

    public function test_an_orphan_whose_parent_is_nowhere_is_reported_and_left_alone(): void
    {
        /*
         * Обратный случай: родителя нет ни в одном зеркале. Придумывать
         * название нечем, и молча поднять узел в корень значило бы
         * потерять запись о том, где он стоял. Такой узел остаётся как
         * есть, а миграция печатает о нём.
         */
        $узел = PostCategory::query()->create([
            'parent_id' => null,
            'name' => 'Ничей',
            'slug' => 'zzz-lonely-child',
            'is_active' => true,
            'depth' => 1,
            'path' => 'zzz-unknown-parent/zzz-lonely-child',
        ]);

        $this->починить();

        $this->assertNull($узел->fresh()->parent_id, 'Узел привязали к выдуманному родителю.');
        $this->assertNull(PostCategory::query()->where('slug', 'zzz-unknown-parent')->first());
    }

    /** Прогон самой миграции — без artisan, чтобы вызов был однозначным. */
    private function починить(): void
    {
        $файл = database_path('migrations/2026_09_29_110000_orphan_directions_return_under_their_parents.php');
        $миграция = require $файл;
        $миграция->up();
    }
}
