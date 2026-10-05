<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\PromocodeUsage;
use Illuminate\Console\Command;
use Modules\Billing\Services\PromocodeService;

/**
 * Снимает брошенные брони мест промокода.
 *
 * Место занимается в момент выдачи скидки (решение владельца от 04.10) и
 * освобождается при отмене или неуспехе платежа. Остаётся третий случай:
 * человек получил цену со скидкой и просто ушёл. Такую бронь снимает эта
 * команда — через тридцать минут.
 *
 * Сама проверка лимита тоже не считает просроченные брони: сторож ходит по
 * расписанию, и между его заходами последнее место иначе простаивало бы.
 * Команда нужна, чтобы строки не копились, а не чтобы лимит был верным, —
 * он верен и без неё.
 *
 * `--dry-run` печатает, что было бы снято, и ничего не трогает: правило
 * проекта для любого массового изменения данных.
 */
final class ReleasePromocodeSeatsCommand extends Command
{
    protected $signature = 'promocodes:release-seats {--dry-run : показать, но не снимать}';

    protected $description = 'Снять брони мест промокода, по которым за 30 минут не было оплаты';

    public function handle(): int
    {
        $граница = now()->subMinutes(PromocodeService::МИНУТ_БРОНИ);

        $запрос = PromocodeUsage::query()
            ->where('status', PromocodeUsage::ЗАНЯТО)
            ->where('reserved_at', '<=', $граница);

        $сколько = (clone $запрос)->count();

        if ($сколько === 0) {
            $this->info('Брошенных броней нет.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->warn("Было бы снято броней: {$сколько} (старше ".PromocodeService::МИНУТ_БРОНИ.' минут)');

            $this->table(
                ['Промокод', 'Человек', 'Занято в'],
                (clone $запрос)->orderBy('reserved_at')->limit(20)->get()
                    ->map(fn (PromocodeUsage $б): array => [
                        $б->promocode_id,
                        $б->user_id,
                        (string) $б->reserved_at,
                    ])->all(),
            );

            return self::SUCCESS;
        }

        $снято = $запрос->delete();
        $this->info("Снято броней: {$снято}");

        return self::SUCCESS;
    }
}
