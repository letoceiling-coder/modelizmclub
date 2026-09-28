<?php

namespace Tests\Feature;

use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Что в баннере на показ влияет, а что нет.
 *
 * Проверка заведена под подсказки в админке: подпись у поля — обещание,
 * и обещать можно только проверенное. «Срок не влияет на показ» — это
 * отрицательное утверждение, а такие в этом проекте доказываются не
 * поиском по коду, а замером.
 *
 * Прогон закрывает четыре утверждения:
 *   1. `until_label` («Срок») — подпись на баннере и ничего больше;
 *   2. `starts_at` / `ends_at` («С» и «По») — окно показа;
 *   3. «тестовый показ» (`force_visible`) окно отменяет;
 *   4. порядок: закреплённые, потом приоритет по убыванию, потом
 *      «Порядок» по возрастанию.
 */
class BannerScheduleAndOrderTest extends TestCase
{
    use RefreshDatabase;

    /*
     * Своя площадка, а не общая «events»: миграция наполнения кладёт
     * туда три демонстрационных баннера, и прогон считал бы их своими.
     * Удалять чужие строки ради проверки — худший из вариантов.
     */
    private const PLACEMENT = 'test-banner-hints';

    /** @param array<string, mixed> $поля */
    private function banner(string $title, array $поля = []): Banner
    {
        return Banner::query()->create(array_merge([
            'placement' => self::PLACEMENT,
            'title' => $title,
            'kind' => 'event',
            'is_active' => true,
            'force_visible' => false,
            'is_pinned' => false,
            'priority' => 0,
            'sort_order' => 0,
        ], $поля));
    }

    /** @return list<string> */
    private function показаны(): array
    {
        return collect(
            $this->getJson('/api/v1/public/banners?placement='.self::PLACEMENT)->assertOk()->json('data'),
        )
            ->pluck('title')
            ->all();
    }

    public function test_the_deadline_caption_does_not_decide_whether_a_banner_is_shown(): void
    {
        /*
         * Три подписи, про которые легко подумать, что они что-то
         * значат: прошедшая дата, будущая и вовсе не дата. Если бы
         * «Срок» влиял на показ, первая убрала бы баннер с экрана.
         */
        $this->banner('Прошлое', ['until_label' => 'до 1 января 2020']);
        $this->banner('Будущее', ['until_label' => 'Открытие 1 октября']);
        $this->banner('Без даты', ['until_label' => 'пока не разберут']);
        $this->banner('Пусто', ['until_label' => null]);

        $this->assertSame(
            ['Прошлое', 'Будущее', 'Без даты', 'Пусто'],
            $this->показаны(),
            'Подпись «Срок» не должна решать, показывать ли баннер.',
        );
    }

    public function test_the_deadline_caption_reaches_the_page_as_text(): void
    {
        // Обратная сторона предыдущего: поле не бесполезно, оно просто
        // работает подписью. Иначе «ни на что не влияет» звучало бы как
        // «его можно удалить».
        $this->banner('С подписью', ['until_label' => 'Открытие 1 октября']);

        $ответ = $this->getJson('/api/v1/public/banners?placement='.self::PLACEMENT)
            ->assertOk()
            ->json('data');

        $this->assertSame('Открытие 1 октября', $ответ[0]['until_label']);
    }

    public function test_the_window_decides_whether_a_banner_is_shown(): void
    {
        $this->banner('Идёт', [
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
        ]);
        $this->banner('Ещё не начался', ['starts_at' => now()->addWeek()]);
        $this->banner('Уже кончился', ['ends_at' => now()->subWeek()]);
        $this->banner('Без окна');

        // Контроль: «Идёт» и «Без окна» на экране — значит проверка
        // вообще умеет находить баннеры, и пустота у двух других
        // означает отказ показа, а не сломанный запрос.
        $this->assertSame(['Идёт', 'Без окна'], $this->показаны());
    }

    public function test_a_test_show_ignores_the_window(): void
    {
        /*
         * Оговорка, без которой подсказка «С и По решают, когда виден»
         * была бы неправдой: «тестовый показ» отменяет окно целиком.
         * В админке у такого баннера стоит предупреждающая метка.
         */
        $this->banner('Кончился, но тестовый', [
            'ends_at' => now()->subWeek(),
            'force_visible' => true,
        ]);
        $this->banner('Кончился и обычный', ['ends_at' => now()->subWeek()]);

        $this->assertSame(['Кончился, но тестовый'], $this->показаны());
    }

    public function test_hidden_banner_is_never_shown_even_inside_the_window(): void
    {
        $this->banner('Выключен', [
            'is_active' => false,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
        ]);
        $this->banner('Включён');

        $this->assertSame(['Включён'], $this->показаны());
    }

    public function test_priority_wins_and_order_breaks_the_tie(): void
    {
        /*
         * Важное для подсказок: у «Приоритета» больше — выше, у
         * «Порядка» меньше — выше. Два соседних поля, и направления у
         * них противоположные; подсказка обязана это сказать.
         */
        $this->banner('Приоритет 5, порядок 30', ['priority' => 5, 'sort_order' => 30]);
        $this->banner('Приоритет 5, порядок 10', ['priority' => 5, 'sort_order' => 10]);
        $this->banner('Приоритет 9, порядок 99', ['priority' => 9, 'sort_order' => 99]);
        $this->banner('Приоритет 1, порядок 0', ['priority' => 1, 'sort_order' => 0]);

        $this->assertSame([
            'Приоритет 9, порядок 99',
            'Приоритет 5, порядок 10',
            'Приоритет 5, порядок 30',
            'Приоритет 1, порядок 0',
        ], $this->показаны());
    }

    public function test_pinned_outranks_priority(): void
    {
        // Ещё одна оговорка для подсказки о приоритете: закрепление
        // сильнее любого числа.
        $this->banner('Закреплён, приоритет 0', ['is_pinned' => true, 'priority' => 0]);
        $this->banner('Не закреплён, приоритет 99', ['priority' => 99]);

        $this->assertSame([
            'Закреплён, приоритет 0',
            'Не закреплён, приоритет 99',
        ], $this->показаны());
    }

    public function test_the_deadline_caption_does_not_touch_the_order(): void
    {
        // На всякий случай и здесь: «Срок» не участвует ни в отборе,
        // ни в сортировке.
        $this->banner('Первый', ['priority' => 9, 'until_label' => 'до 1 января 2020']);
        $this->banner('Второй', ['priority' => 1, 'until_label' => 'Открытие 1 октября']);

        $this->assertSame(['Первый', 'Второй'], $this->показаны());
    }
}
