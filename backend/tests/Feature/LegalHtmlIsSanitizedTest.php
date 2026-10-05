<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\LegalPage;
use App\Models\User;
use App\Support\LegalHtmlSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Разметка правовых страниц чистится по белому списку. Решение владельца 04.10.
 *
 * Белый список, а не чёрный: перечислить всё опасное нельзя — имена
 * атрибутов-обработчиков пополняются с каждой версией браузера. Поэтому
 * проверка идёт с двух сторон: опасное не проходит, а нужное договору —
 * проходит. Без второй половины «очистка» могла бы просто выбрасывать всё.
 */
final class LegalHtmlIsSanitizedTest extends TestCase
{
    use RefreshDatabase;

    private function чистильщик(): LegalHtmlSanitizer
    {
        return app(LegalHtmlSanitizer::class);
    }

    public function test_scripts_and_handlers_do_not_survive(): void
    {
        $итог = $this->чистильщик()->очистить(
            '<p onclick="alert(1)">раз</p><script>alert(2)</script><img src="x" onerror="alert(3)">',
        );

        self::assertStringNotContainsString('<script', $итог['html']);
        self::assertStringNotContainsString('onclick', $итог['html']);
        self::assertStringNotContainsString('onerror', $итог['html']);
        self::assertStringNotContainsString('alert(2)', $итог['html'], 'содержимое скрипта вынесено в текст страницы');
    }

    public function test_javascript_links_and_frames_do_not_survive(): void
    {
        $итог = $this->чистильщик()->очистить(
            '<a href="javascript:alert(1)">жми</a><iframe src="https://чужой.example"></iframe>',
        );

        self::assertStringNotContainsString('javascript:', $итог['html']);
        self::assertStringNotContainsString('<iframe', $итог['html']);
        self::assertStringContainsString('жми', $итог['html'], 'текст ссылки пропал вместе с адресом');
    }

    public function test_what_a_contract_needs_survives(): void
    {
        $исходник = '<h2>Раздел 1</h2><p>Текст <strong>важный</strong> и <em>наклонный</em>.</p>'
            .'<ul><li>пункт</li></ul><table><tr><td colspan="2">ячейка</td></tr></table>'
            .'<a href="https://modelizmclub.ru/rules">правила</a>';

        $итог = $this->чистильщик()->очистить($исходник);

        foreach (['<h2>', '<strong>', '<em>', '<ul>', '<li>', '<table>', 'colspan="2"', 'href="https://modelizmclub.ru/rules"'] as $нужное) {
            self::assertStringContainsString($нужное, $итог['html'], "очистка забрала нужное: {$нужное}");
        }

        self::assertSame(0, $итог['убрано_тегов']);
    }

    public function test_an_external_link_cannot_reach_back(): void
    {
        $итог = $this->чистильщик()->очистить('<a href="https://example.org">туда</a>');

        self::assertStringContainsString('rel="noopener noreferrer"', $итог['html']);
    }

    public function test_cyrillic_is_not_mangled(): void
    {
        $итог = $this->чистильщик()->очистить('<p>Соглашение вступает в силу с 1 января.</p>');

        self::assertStringContainsString('Соглашение вступает в силу с 1 января.', $итог['html']);
    }

    public function test_saving_a_page_through_the_admin_cleans_it(): void
    {
        $владелец = User::factory()->create(['role' => UserRole::Owner]);

        $this->actingAs($владелец, 'sanctum')
            ->postJson('/api/v1/admin/legal-pages', [
                'slug' => 'stand-rules',
                'title' => 'Правила стенда',
                'content_html' => '<h2>Раздел</h2><p onclick="alert(1)">текст</p><script>alert(2)</script>',
            ])
            ->assertSuccessful();

        $сохранено = (string) LegalPage::query()->where('slug', 'stand-rules')->value('content_html');

        self::assertStringNotContainsString('<script', $сохранено, 'в базу легла разметка со скриптом');
        self::assertStringNotContainsString('onclick', $сохранено);
        self::assertStringContainsString('<h2>Раздел</h2>', $сохранено, 'очистка забрала содержимое страницы');
    }
}
