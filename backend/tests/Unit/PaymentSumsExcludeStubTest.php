<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Сторож: сумма по платежам — только через Payment::countable().
 *
 * Заглушка ставит платежу статус «оплачен» без банка; 11.09 таких в боевой
 * базе было 13 на 6 187 ₽. Сумм по платежам в коде пока нет, но появятся —
 * выручка, итоги, отчёты. Этот тест не даст сложить `amount_cents` по
 * платежам, не отсекая заглушку: выражение, где рядом с суммой нет
 * `countable()`, валит прогон с именем файла и строкой.
 *
 * Правило грубое и нарочно такое: смотрит на выражение от предыдущей `;` до
 * самой суммы. Если сумма честно не про платежи (другая таблица с тем же
 * столбцом), в выражении не будет ни `Payment`, ни `payments` — такое он не
 * трогает.
 */
class PaymentSumsExcludeStubTest extends TestCase
{
    private const SUM = '/(?:->sum\(\s*[\'"]amount_cents[\'"]|SUM\s*\(\s*"?amount_cents)/i';

    /** @return list<string> «файл:строка» каждой суммы по платежам без countable() */
    public static function violations(string $code, string $file = 'inline'): array
    {
        if (! preg_match_all(self::SUM, $code, $matches, PREG_OFFSET_CAPTURE)) {
            return [];
        }

        $found = [];
        foreach ($matches[0] as [$match, $offset]) {
            // Всё выражение — от предыдущей `;` до следующей: в сыром SQL
            // имя таблицы стоит после суммы («SUM(amount_cents) from payments»).
            $before = substr($code, 0, $offset);
            $start = strrpos($before, ';');
            $start = $start === false ? 0 : $start + 1;
            $end = strpos($code, ';', $offset);
            $statement = substr($code, $start, ($end === false ? strlen($code) : $end) - $start);

            $aboutPayments = str_contains($statement, 'Payment') || stripos($statement, 'payments') !== false;
            if (! $aboutPayments || str_contains($statement, 'countable()')) {
                continue;
            }

            $found[] = $file.':'.(substr_count($before, "\n") + 1);
        }

        return $found;
    }

    public function test_every_sum_over_payments_goes_through_countable(): void
    {
        $app = dirname(__DIR__, 2).'/app';
        $found = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($app)) as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }
            $relative = 'app'.substr($file->getPathname(), strlen($app));
            array_push($found, ...self::violations((string) file_get_contents($file->getPathname()), $relative));
        }

        $this->assertSame([], $found, "Сумма по платежам без Payment::countable() — заглушка попадёт в деньги:\n".implode("\n", $found));
    }

    public function test_detector_catches_planted_sums_and_passes_countable(): void
    {
        $this->assertNotEmpty(self::violations("\$t = Payment::query()->where('status', 'paid')->sum('amount_cents');"));
        $this->assertNotEmpty(self::violations('$rows = DB::select("select SUM(amount_cents) from payments where status = \'paid\'");'));
        $this->assertSame([], self::violations("\$t = Payment::query()->countable()->where('status', 'paid')->sum('amount_cents');"));
        $this->assertSame([], self::violations("\$t = WalletTransaction::query()->sum('amount_cents');"));
    }
}
