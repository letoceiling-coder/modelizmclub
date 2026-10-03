<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * В умолчании списка источников нет localhost.
 *
 * До 03.10 он там стоял, причём при `supports_credentials => true`: любая
 * страница, отданная с этого порта на машине человека — чужой dev-сервер,
 * пакет из npm, локальное приложение, — ходила к боевому API с его учётными
 * данными и читала ответы.
 *
 * Умолчание действует чаще, чем кажется: по разбору в
 * `frontend/docs/backend-endpoints-needed.md` на стенде переменной
 * `CORS_ALLOWED_ORIGINS` не было задано вовсе.
 *
 * Читаем файл, а не `config()`: это проверка самого умолчания, и подмешивать
 * сюда окружение машины, на которой идёт прогон, незачем.
 */
class CorsDefaultOriginsTest extends TestCase
{
    /**
     * Сам литерал умолчания, без окружающих комментариев.
     *
     * Читать файл целиком нельзя: разбор этой правки записан прямо над
     * строкой и упоминает `localhost` словами — проверка «в файле нет
     * localhost» ловила бы собственное объяснение.
     */
    private function умолчание(): string
    {
        $текст = (string) file_get_contents(dirname(__DIR__, 2).'/config/cors.php');

        $нашлось = preg_match("/env\\('CORS_ALLOWED_ORIGINS',\\s*'([^']*)'/", $текст, $совпадение);
        $this->assertSame(1, $нашлось, 'Умолчание не нашлось — проверка не выполнялась.');

        return $совпадение[1];
    }

    public function test_the_default_has_no_localhost(): void
    {
        $текст = $this->умолчание();

        $this->assertStringNotContainsString('localhost', $текст);
        $this->assertStringNotContainsString('127.0.0.1', $текст);
    }

    public function test_the_default_still_has_the_live_domains(): void
    {
        $текст = $this->умолчание();

        $this->assertStringContainsString('https://modelizmclub.ru', $текст);
        $this->assertStringContainsString('https://www.modelizmclub.ru', $текст);
    }

    public function test_credentials_are_still_on(): void
    {
        // Передача учётных данных — то, из-за чего localhost в списке был
        // опасен. Если её выключат, проверка выше потеряет смысл, и об этом
        // надо узнать здесь, а не на разборе.
        $файл = (string) file_get_contents(dirname(__DIR__, 2).'/config/cors.php');
        $this->assertStringContainsString("'supports_credentials' => true", $файл);
    }
}
