<?php

namespace App\Console\Commands;

use App\Enums\WalletTransactionType;
use App\Models\User;
use Illuminate\Console\Command;
use Modules\Admin\Services\AuditService;
use Modules\Billing\Services\WalletService;
use Throwable;

/**
 * Обнулить балансы учётных записей приёмки перед запуском.
 *
 * Зачем команда, а не разовый скрипт в tinker: правка денег на нескольких
 * учётках — массовое изменение данных, а для таких правило требует сухого
 * прогона и проверки выборки со стороны данных. Разовый скрипт этого не
 * даёт и не оставляет следа.
 *
 * Проводки не удаляются. Обнуление — это новая строка списания поверх
 * истории: удалять проводки значит рвать сведение баланса, а так остаётся
 * видно и сколько было, и кто убрал.
 *
 * На 25.09 на учётках приёмки лежало 22 660,45 ₽ игровых денег: 8 380 у
 * 1229 и 14 280,45 у 1230.
 */
class ZeroWalletsCommand extends Command
{
    protected $signature = 'wallets:zero
        {users* : id учётных записей через пробел}
        {--actor= : id того, от чьего имени пишется аудит}
        {--reason= : причина, попадёт в описание операции и в аудит}
        {--dry-run : показать, что будет сделано, ничего не меняя}';

    protected $description = 'Обнулить балансы указанных учётных записей с записью в аудит';

    public function handle(WalletService $wallets, AuditService $audit): int
    {
        $dry = (bool) $this->option('dry-run');
        $reason = (string) ($this->option('reason') ?: 'Обнуление учётной записи приёмки');

        $actor = null;
        if ($this->option('actor')) {
            $actor = User::query()->find((int) $this->option('actor'));
            if ($actor === null) {
                $this->error('Учётка для аудита не найдена: '.$this->option('actor'));

                return self::FAILURE;
            }
        }

        $всего = 0;
        $тронуто = 0;

        foreach ($this->argument('users') as $raw) {
            $user = User::query()->find((int) $raw);
            if ($user === null) {
                $this->error('Нет учётки '.$raw);

                return self::FAILURE;
            }

            $wallet = $wallets->wallet($user);
            $было = (int) $wallet->balance_kopecks;
            $залог = (int) $wallet->held_kopecks;

            if ($залог !== 0) {
                // Залог принадлежит незакрытой сделке, а не кошельку. Списать
                // его отсюда значило бы оставить сделку без обеспечения.
                $this->error(sprintf('%d (%s): в залоге %d коп. — сначала закройте сделки', $user->id, $user->email, $залог));

                return self::FAILURE;
            }

            if ($было <= 0) {
                $this->line(sprintf('  %d (%s): уже %d — пропускаю', $user->id, $user->email, $было));

                continue;
            }

            $this->line(sprintf('  %d (%s): %d коп. → 0', $user->id, $user->email, $было));
            $всего += $было;
            $тронуто++;

            if ($dry) {
                continue;
            }

            try {
                $wallets->debit($user, $было, WalletTransactionType::AdminAdjustment, $reason);
                $audit->log($actor, 'admin.wallets.zeroed', $user, ['balance_kopecks' => $было], ['balance_kopecks' => 0]);
            } catch (Throwable $e) {
                $this->error(sprintf('%d: не вышло — %s', $user->id, $e->getMessage()));

                return self::FAILURE;
            }
        }

        $this->info(sprintf(
            '%s учёток: %d, сумма: %d коп. (%s ₽)',
            $dry ? 'Сухой прогон. Затронуло бы' : 'Обнулено',
            $тронуто,
            $всего,
            number_format($всего / 100, 2, ',', ' '),
        ));

        return self::SUCCESS;
    }
}
