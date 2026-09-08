<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Каждый изменяющий маршрут админки обязан писать в журнал.
 *
 * 08.09 прогон по проду дал две строки аудита за весь сеанс: одобрение двух
 * объявлений, отклонение поста и деление денег в споре не записались вовсе —
 * четыре контроллера не знали про AuditService. Тест сторожит границу, чтобы
 * следующий admin-маршрут не приехал молча.
 */
class AdminAuditCoverageTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Загрузка медиа сознательно вне журнала: кроппер баннера шлёт запрос на
     * каждое сохранение рамки. Значимо то, что с файлом сделали дальше, —
     * баннер, иконка и карточка лендинга логируются каждый.
     *
     * @var list<string>
     */
    private const ALLOWED_WITHOUT_AUDIT = ['AdminMediaController'];

    public function test_every_mutating_admin_route_logs_to_audit(): void
    {
        $routes = file_get_contents(base_path('app/Modules/Admin/routes/api.php'));
        preg_match_all(
            "/Route::(post|patch|put|delete)\('([^']+)'\s*,\s*(?:\[)?\\\\?([\w\\\\]+)::class/",
            $routes,
            $matches,
            PREG_SET_ORDER,
        );

        $this->assertNotEmpty($matches, 'Маршруты админки не разобрались — проверьте формат файла.');

        $silent = [];
        foreach ($matches as [, $verb, $path, $class]) {
            $name = class_basename(str_replace('\\\\', '\\', $class));

            if (in_array($name, self::ALLOWED_WITHOUT_AUDIT, true)) {
                continue;
            }

            $file = $this->controllerPath($name);
            if ($file === null) {
                $silent[] = strtoupper($verb).' '.$path.' — контроллер '.$name.' не найден';

                continue;
            }

            if (! str_contains(file_get_contents($file), 'AuditService')) {
                $silent[] = strtoupper($verb).' '.$path.' — '.$name;
            }
        }

        $this->assertSame([], $silent, "Изменяют данные и не пишут в аудит:\n".implode("\n", $silent));
    }

    private function controllerPath(string $name): ?string
    {
        $direct = base_path('app/Modules/Admin/Http/Controllers/Api/V1/'.$name.'.php');
        if (is_file($direct)) {
            return $direct;
        }

        foreach (glob(base_path('app/Modules/Admin/**/'.$name.'.php'), GLOB_BRACE) ?: [] as $found) {
            return $found;
        }

        return null;
    }
}
