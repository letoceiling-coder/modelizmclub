<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Четыре роли: owner, moderator, category_admin, user (решение 19.09).
 *
 * До этого Владельцем был любой `admin`, и различить их было нельзя. Все
 * действующие `admin` становятся `owner`: на проде после понижения учётки
 * приёмки это 508, 1203 и 1204 — ровно те, кого решено сделать
 * Владельцами. Роль `subscriber` никому не выдавалась (подписку определяет
 * таблица подписок); если строка всё же найдётся — она становится `user`.
 *
 * Каждая смена пишется в журнал изменений, как правка роли из админки.
 */
return new class extends Migration
{
    private const RENAMES = [
        'admin' => 'owner',
        'subscriber' => 'user',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            foreach (self::RENAMES as $from => $to) {
                $ids = DB::table('users')->where('role', $from)->orderBy('id')->pluck('id');
                if ($ids->isEmpty()) {
                    continue;
                }

                DB::table('users')->whereIn('id', $ids)->update(['role' => $to]);

                DB::table('audit_logs')->insert($ids->map(fn (int $id): array => [
                    'user_id' => null,
                    'action' => 'system.users.role_renamed',
                    'auditable_type' => 'App\\Models\\User',
                    'auditable_id' => $id,
                    'old_values' => json_encode(['role' => $from]),
                    'new_values' => json_encode(['role' => $to]),
                    'created_at' => now(),
                ])->all());
            }
        });
    }

    /**
     * Обратно — `owner` в `admin`. Администратор направления в старой схеме
     * не существовал и становится обычным пользователем.
     */
    public function down(): void
    {
        DB::table('users')->where('role', 'owner')->update(['role' => 'admin']);
        DB::table('users')->where('role', 'category_admin')->update(['role' => 'user']);
    }
};
