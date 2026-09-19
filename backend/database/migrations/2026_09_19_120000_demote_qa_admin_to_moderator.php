<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Учётка приёмки `admin@modelizmclub.ru` (на проде id 1207) — модератор.
 *
 * Её завёл ReferenceDataSeeder с ролью admin, то есть с полными правами
 * владельца: деньги, роли, настройки. Для приёмки нужен модератор, и
 * держать служебную учётку с доступом к выплатам незачем (решение 19.09).
 *
 * Ищем по почте, а не по id: в тестовых и локальных базах id другой. Роль
 * меняется, только если сейчас стоит admin, — повторный прогон и уже
 * переназначенная руками учётка остаются как есть. Смена пишется в журнал
 * изменений, как при правке роли из админки.
 */
return new class extends Migration
{
    private const EMAIL = 'admin@modelizmclub.ru';

    public function up(): void
    {
        $user = DB::table('users')
            ->where('email', self::EMAIL)
            ->where('role', 'admin')
            ->first(['id']);

        if ($user === null) {
            return;
        }

        DB::transaction(function () use ($user): void {
            DB::table('users')->where('id', $user->id)->update(['role' => 'moderator']);

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'action' => 'system.users.role_demoted',
                'auditable_type' => 'App\\Models\\User',
                'auditable_id' => $user->id,
                'old_values' => json_encode(['role' => 'admin']),
                'new_values' => json_encode(['role' => 'moderator', 'reason' => 'учётка приёмки, решение 19.09']),
                'created_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // Возврат прав владельца служебной учётке — сознательное действие
        // из админки, а не побочный эффект отката миграций.
    }
};
