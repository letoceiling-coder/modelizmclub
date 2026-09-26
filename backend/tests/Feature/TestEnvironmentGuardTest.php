<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use RuntimeException;
use Tests\TestCase;

/**
 * Защита прогона от боевого окружения (E6).
 *
 * 13.09 кто-то выполнил полный набор в каталоге прода: в базе остался
 * кеш на 839 тестов, включая подтверждение телефона, которое тогда ещё
 * ходило в настоящий SMS-шлюз. Назвать человека по журналам нельзя —
 * команда шла от root напрямую, минуя sudo, и следов не оставила.
 * Поэтому закрыта сама возможность.
 *
 * Проверки живут в `TestCase::refreshApplication()`, то есть до первой
 * миграции. Раньше они стояли в `setUp()` после `parent::setUp()`, а тот
 * внутри себя зовёт `RefreshDatabase` — и защита срабатывала уже после
 * `migrate:fresh`. Измерено 26.09: с прежним порядком посторонняя пустая
 * база получала 142 таблицы, с нынешним остаётся пустой.
 */
class TestEnvironmentGuardTest extends TestCase
{
    public function test_боевое_имя_базы_отклоняется(): void
    {
        Config::set('database.connections.pgsql.database', 'modelizmclub');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/isolated database/');

        $this->refreshApplicationForCheck();
    }

    public function test_настоящие_доступы_к_sms_отклоняются(): void
    {
        Config::set('sms.iqsms.login', 'боевой-логин');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/real SMS credentials/');

        $this->refreshApplicationForCheck();
    }

    public function test_не_тестовое_окружение_отклоняется(): void
    {
        app()['env'] = 'production';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/APP_ENV=testing/');

        $this->refreshApplicationForCheck();
    }

    /** Обычное окружение проверку проходит — иначе весь набор был бы красным. */
    public function test_обычное_окружение_проходит(): void
    {
        $this->refreshApplicationForCheck();

        $this->assertTrue(true);
    }

    /**
     * Позвать ровно проверку, не пересоздавая приложение: `refreshApplication()`
     * заодно поднял бы его заново и потерял подменённую настройку.
     */
    private function refreshApplicationForCheck(): void
    {
        $метод = new \ReflectionMethod(TestCase::class, 'assertEnvironmentIsSafeForTests');
        $метод->setAccessible(true);
        $метод->invoke($this);
    }
}
