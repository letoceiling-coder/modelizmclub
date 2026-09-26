<?php

namespace Tests\Feature;

use App\Rules\SafeEmail;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Правило SafeEmail стоит на каждом поле, где адрес приходит извне.
 *
 * Стандартный `email` в Laravel 11 пропускает часть последовательностей с
 * переводом строки (GHSA-5vg9-5847-vvmq, high), а Symfony Mailer потом
 * подставляет адрес в заголовки письма. Заплатки для 11.x нет: composer
 * отказывается ставить любой выпуск от 11.31.0 до 11.56.1, исправлено только
 * в 12.60. Пока перехода нет, дыру закрывает наше правило — значит оно должно
 * стоять везде, а не почти везде.
 *
 * До 26.09 одно поле было забыто: `guest_email` у обратной связи, на открытом
 * маршруте. Через заголовки письма оттуда было не достать — адрес шёл в текст
 * обращения, — но правило существует ровно для того, чтобы следующий
 * `Reply-To` не сделал маршрут проходом.
 *
 * Правило, за которым никто не следит, — не правило. Следит этот тест.
 */
class SafeEmailRuleEverywhereTest extends TestCase
{
    /** Управляющие символы, которыми Symfony Mime может разорвать строку. */
    public static function опасные(): array
    {
        return [
            'перевод строки' => ["a@b.ru\nBcc: chужой@b.ru"],
            'возврат каретки' => ["a@b.ru\rBcc: chужой@b.ru"],
            'CRLF' => ["a@b.ru\r\nBcc: chужой@b.ru"],
            'нулевой байт' => ["a@b.ru\0"],
            'табуляция' => ["a@b.ru\tBcc: chужой@b.ru"],
            'NEL' => ["a@b.ru\u{0085}"],
            'разделитель строк' => ["a@b.ru\u{2028}"],
            'разделитель абзацев' => ["a@b.ru\u{2029}"],
        ];
    }

    #[DataProvider('опасные')]
    public function test_правило_отбивает_управляющие_символы(string $адрес): void
    {
        $проверка = Validator::make(['email' => $адрес], ['email' => ['email', new SafeEmail]]);

        $this->assertTrue(
            $проверка->fails(),
            'адрес с управляющим символом должен отбиваться: '.json_encode($адрес),
        );
    }

    public function test_обычный_адрес_проходит(): void
    {
        $проверка = Validator::make(
            ['email' => 'petr.ivanov+tag@example.ru'],
            ['email' => ['email', new SafeEmail]],
        );

        $this->assertFalse($проверка->fails(), 'законный адрес отбиваться не должен');
    }

    /**
     * Обход исходников: ни одно поле с правилом `email` не остаётся без SafeEmail.
     *
     * Проверка идёт по коду, а не по списку маршрутов: новый эндпоинт появится
     * раньше, чем кто-нибудь вспомнит дописать его в список.
     */
    public function test_все_поля_с_правилом_email_несут_safeemail(): void
    {
        $корень = base_path('app');
        $файлы = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($корень));
        $безПравила = [];
        $всего = 0;

        foreach ($файлы as $файл) {
            if ($файл->isDir() || $файл->getExtension() !== 'php') {
                continue;
            }

            $текст = file_get_contents($файл->getPathname());

            preg_match_all(
                '/[\'"](\w*email\w*)[\'"]\s*=>\s*(\[[^\]]*\]|[\'"][^\'"]*[\'"])/s',
                $текст,
                $совпадения,
                PREG_SET_ORDER,
            );

            foreach ($совпадения as $совпадение) {
                [, $поле, $правила] = $совпадение;

                // Это валидация, а не сообщение об ошибке и не выдача данных.
                if (preg_match('/[\'"]email(:[a-z,]+)?[\'"]/', $правила) !== 1) {
                    continue;
                }

                $всего++;

                if (! str_contains($правила, 'SafeEmail')) {
                    $безПравила[] = str_replace($корень.'/', '', $файл->getPathname()).': '.$поле;
                }
            }
        }

        $this->assertGreaterThan(
            5,
            $всего,
            'проверка ничего не нашла — значит разбор сломался, а не поля исчезли',
        );

        $this->assertSame(
            [],
            $безПравила,
            "Поля с правилом email без SafeEmail:\n  ".implode("\n  ", $безПравила)
            ."\nСтандартный email в Laravel 11 пропускает переводы строки, заплатки для 11.x нет.",
        );
    }
}
