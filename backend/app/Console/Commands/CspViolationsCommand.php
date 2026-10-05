<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Список накопленных нарушений Content-Security-Policy.
 *
 * Решение владельца от 04.10: политику пока не включать, сначала собрать и
 * посмотреть, что она сломала бы. Отчёты копятся в `storage/logs/csp*.log`
 * с тех пор, как заголовок поставлен в режим отчёта.
 *
 * Читать этот журнал глазами бессмысленно: одна страница присылает десятки
 * одинаковых отчётов, и в сыром виде это тысячи строк, из которых интересны
 * два поля — какое правило сработало и что именно оно остановило. Команда
 * сводит их в список «правило → источник → сколько раз → где видели».
 *
 * Ничего не включает и не меняет: только читает журнал.
 *
 *   php artisan csp:violations
 *   php artisan csp:violations --json      для машинной обработки
 *   php artisan csp:violations --limit=50
 */
final class CspViolationsCommand extends Command
{
    protected $signature = 'csp:violations {--json : выдать JSON вместо таблицы} {--limit=30 : сколько строк показать}';

    protected $description = 'Свести накопленные отчёты CSP в список: правило, источник, число случаев';

    public function handle(): int
    {
        $файлы = glob(storage_path('logs/csp*.log')) ?: [];

        if ($файлы === []) {
            $this->warn('Журналов CSP нет: '.storage_path('logs/csp*.log'));
            $this->line('Это «отчётов не поступало» либо «журнал не ведётся» — различить отсюда нельзя.');
            $this->line('Проверить: заголовок Content-Security-Policy-Report-Only отдаётся сервером?');

            return self::SUCCESS;
        }

        $сводка = [];
        $всего = 0;
        $нечитаемых = 0;

        foreach ($файлы as $файл) {
            foreach (preg_split('/\R/', (string) File::get($файл)) ?: [] as $строка) {
                if (! str_contains($строка, 'csp-violation')) {
                    continue;
                }

                $отчёт = $this->разобрать($строка);

                if ($отчёт === null) {
                    $нечитаемых++;

                    continue;
                }

                $всего++;
                $ключ = $отчёт['правило'].'|'.$отчёт['источник'];
                $сводка[$ключ] ??= [
                    'правило' => $отчёт['правило'],
                    'источник' => $отчёт['источник'],
                    'случаев' => 0,
                    'страницы' => [],
                ];
                $сводка[$ключ]['случаев']++;

                if ($отчёт['страница'] !== '' && count($сводка[$ключ]['страницы']) < 5) {
                    $сводка[$ключ]['страницы'][$отчёт['страница']] = true;
                }
            }
        }

        usort($сводка, static fn (array $a, array $b): int => $b['случаев'] <=> $a['случаев']);

        $строки = array_map(static fn (array $s): array => [
            'правило' => $s['правило'],
            'источник' => $s['источник'],
            'случаев' => $s['случаев'],
            'страницы' => implode(', ', array_keys($s['страницы'])),
        ], array_slice($сводка, 0, (int) $this->option('limit')));

        if ($this->option('json')) {
            $this->line((string) json_encode([
                'всего_отчётов' => $всего,
                'не_разобрано' => $нечитаемых,
                'файлов' => count($файлы),
                'список' => $строки,
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            return self::SUCCESS;
        }

        $this->info("Отчётов: {$всего}, различных нарушений: ".count($сводка).', файлов журнала: '.count($файлы));

        if ($нечитаемых > 0) {
            $this->warn("Не разобрано строк: {$нечитаемых} — они не учтены в числах выше.");
        }

        if ($строки === []) {
            $this->line('Записей о нарушениях в журналах нет.');

            return self::SUCCESS;
        }

        $this->table(['Правило', 'Что остановлено', 'Случаев', 'Где видели'], array_map(
            static fn (array $s): array => [
                $s['правило'],
                mb_strimwidth($s['источник'], 0, 48, '…'),
                $s['случаев'],
                mb_strimwidth($s['страницы'], 0, 44, '…'),
            ],
            $строки,
        ));

        $this->newLine();
        $this->line('Политика остаётся в режиме отчёта. Включать запрет — отдельным решением,');
        $this->line('после того как каждая строка выше объяснена или устранена.');

        return self::SUCCESS;
    }

    /**
     * Достаёт из строки журнала три поля.
     *
     * Формат строки задаёт Monolog, а внутри — JSON от браузера, у которого
     * две разные формы: старая `csp-report` и новая `report-to`. Берём обе,
     * иначе половина отчётов тихо не попадёт в список.
     *
     * @return array{правило: string, источник: string, страница: string}|null
     */
    private function разобрать(string $строка): ?array
    {
        $начало = strpos($строка, '{');

        if ($начало === false) {
            return null;
        }

        $данные = json_decode(substr($строка, $начало), true);

        if (! is_array($данные)) {
            return null;
        }

        $отчёт = $данные['report'] ?? $данные;
        $тело = $отчёт['csp-report'] ?? $отчёт['body'] ?? $отчёт;

        if (! is_array($тело)) {
            return null;
        }

        $правило = (string) ($тело['effective-directive'] ?? $тело['effectiveDirective'] ?? $тело['violated-directive'] ?? '');
        $источник = (string) ($тело['blocked-uri'] ?? $тело['blockedURL'] ?? '');
        $страница = (string) ($тело['document-uri'] ?? $тело['documentURL'] ?? '');

        if ($правило === '' && $источник === '') {
            return null;
        }

        return [
            'правило' => $правило !== '' ? $правило : '(не указано)',
            'источник' => $источник !== '' ? $источник : '(не указан)',
            'страница' => $страница !== '' ? parse_url($страница, PHP_URL_PATH) ?: $страница : '',
        ];
    }
}
